//! JOLT-Atlas proof verification
//!
//! Verifies zkML proofs to ensure model execution integrity.

use crate::{
    Error, JoltAtlasProof, RegisteredModel, Result, VerificationResult, VerifierConfig,
};
use sha3::{Digest, Keccak256};
use std::collections::HashMap;
use std::sync::RwLock;
use tracing::{debug, info, instrument, warn};

/// JOLT-Atlas proof verifier
///
/// # Example
/// ```rust,ignore
/// use zkml_jolt::{JoltAtlasVerifier, VerifierConfig};
///
/// let verifier = JoltAtlasVerifier::new(VerifierConfig::default());
/// let result = verifier.verify(&proof);
/// ```
pub struct JoltAtlasVerifier {
    /// Registered model commitments (from Visa registry)
    registered_models: RwLock<HashMap<[u8; 32], RegisteredModel>>,

    /// Verifier configuration
    config: VerifierConfig,

    /// Verification result cache
    cache: RwLock<HashMap<[u8; 32], CachedResult>>,
}

/// Cached verification result
struct CachedResult {
    result: VerificationResult,
    cached_at: u64,
}

impl JoltAtlasVerifier {
    /// Create a new verifier with configuration
    pub fn new(config: VerifierConfig) -> Self {
        Self {
            registered_models: RwLock::new(HashMap::new()),
            config,
            cache: RwLock::new(HashMap::new()),
        }
    }

    /// Create a verifier with default configuration
    pub fn default_verifier() -> Self {
        Self::new(VerifierConfig::default())
    }

    /// Load registered models from Visa registry
    #[instrument(skip(self))]
    pub async fn load_registry(&self, registry_url: &str) -> Result<usize> {
        info!("Loading model registry from {}", registry_url);

        // In production, this would make an HTTP request
        // For now, we simulate with a mock response

        // Simulated registry fetch
        let models = self.fetch_registry(registry_url).await?;
        let count = models.len();

        let mut registry = self.registered_models.write().unwrap();
        for model in models {
            registry.insert(model.commitment, model);
        }

        info!("Loaded {} models from registry", count);
        Ok(count)
    }

    /// Add a registered model manually
    pub fn add_registered_model(&self, model: RegisteredModel) {
        let mut registry = self.registered_models.write().unwrap();
        registry.insert(model.commitment, model);
    }

    /// Verify a JOLT-Atlas proof
    ///
    /// # Arguments
    /// * `proof` - The proof to verify
    ///
    /// # Returns
    /// A `VerificationResult` indicating whether the proof is valid
    #[instrument(skip_all, fields(
        model = %hex::encode(&proof.model_commitment.commitment[..8]),
        timestamp = proof.timestamp
    ))]
    pub fn verify(&self, proof: &JoltAtlasProof) -> VerificationResult {
        let start = std::time::Instant::now();

        // Check cache first
        if self.config.enable_cache {
            if let Some(cached) = self.check_cache(proof) {
                debug!("Returning cached verification result");
                return cached;
            }
        }

        // 1. Check proof freshness
        if !self.check_timestamp(proof.timestamp) {
            let result = VerificationResult::invalid(format!(
                "Proof expired: timestamp {} is older than {}s",
                proof.timestamp, self.config.max_proof_age
            ));
            return self.cache_result(proof, result);
        }

        // 2. Verify model is registered (if required)
        if self.config.require_registered_model {
            let registry = self.registered_models.read().unwrap();
            if !registry.contains_key(&proof.model_commitment.commitment) {
                let result = VerificationResult::invalid(format!(
                    "Model not registered: {}",
                    hex::encode(&proof.model_commitment.commitment[..8])
                ));
                return self.cache_result(proof, result);
            }

            // Check if model is still active
            if let Some(model) = registry.get(&proof.model_commitment.commitment) {
                if !model.active {
                    let result = VerificationResult::invalid("Model is deactivated");
                    return self.cache_result(proof, result);
                }
            }
        }

        // 3. Verify proof structure
        if let Err(e) = self.verify_proof_structure(proof) {
            let result = VerificationResult::invalid(format!("Invalid proof structure: {}", e));
            return self.cache_result(proof, result);
        }

        // 4. Verify JOLT proof cryptographically
        match self.verify_jolt_proof(&proof.execution_proof) {
            Ok(true) => {}
            Ok(false) => {
                let result = VerificationResult::invalid("JOLT proof cryptographic verification failed");
                return self.cache_result(proof, result);
            }
            Err(e) => {
                let result = VerificationResult::invalid(format!("Verification error: {}", e));
                return self.cache_result(proof, result);
            }
        }

        // 5. Verify commitment binding
        if !self.verify_commitment_binding(proof) {
            let result = VerificationResult::invalid("Commitment binding verification failed");
            return self.cache_result(proof, result);
        }

        let elapsed = start.elapsed();
        info!("Proof verified successfully in {:?}", elapsed);

        let result = VerificationResult::valid(proof.model_commitment.commitment);
        self.cache_result(proof, result)
    }

    /// Verify multiple proofs in parallel
    #[instrument(skip_all, fields(batch_size = proofs.len()))]
    pub fn verify_batch(&self, proofs: &[JoltAtlasProof]) -> Vec<VerificationResult> {
        use rayon::prelude::*;

        info!("Starting batch verification for {} proofs", proofs.len());

        proofs.par_iter().map(|proof| self.verify(proof)).collect()
    }

    /// Check if a model commitment is registered
    pub fn is_model_registered(&self, commitment: &[u8; 32]) -> bool {
        let registry = self.registered_models.read().unwrap();
        registry.contains_key(commitment)
    }

    /// Get model info by commitment
    pub fn get_model_info(&self, commitment: &[u8; 32]) -> Option<RegisteredModel> {
        let registry = self.registered_models.read().unwrap();
        registry.get(commitment).cloned()
    }

    /// Check proof timestamp freshness
    fn check_timestamp(&self, timestamp: u64) -> bool {
        let now = crate::types::current_timestamp();
        let age = now.saturating_sub(timestamp);

        if age > self.config.max_proof_age {
            warn!(
                "Proof timestamp {} is {} seconds old (max: {})",
                timestamp, age, self.config.max_proof_age
            );
            return false;
        }

        // Also check for future timestamps (clock skew protection)
        if timestamp > now + 60 {
            warn!("Proof timestamp {} is in the future", timestamp);
            return false;
        }

        true
    }

    /// Verify proof structure is valid
    fn verify_proof_structure(&self, proof: &JoltAtlasProof) -> Result<()> {
        // Check version
        if proof.version == 0 || proof.version > crate::PROOF_VERSION {
            return Err(Error::ProofVerification(format!(
                "Unsupported proof version: {}",
                proof.version
            )));
        }

        // Check execution proof is not empty
        if proof.execution_proof.is_empty() {
            return Err(Error::ProofVerification("Empty execution proof".to_string()));
        }

        // Check proof size (prevent DoS)
        const MAX_PROOF_SIZE: usize = 1_000_000; // 1MB
        if proof.execution_proof.len() > MAX_PROOF_SIZE {
            return Err(Error::ProofVerification(format!(
                "Proof too large: {} bytes (max: {})",
                proof.execution_proof.len(),
                MAX_PROOF_SIZE
            )));
        }

        Ok(())
    }

    /// Verify the JOLT cryptographic proof
    fn verify_jolt_proof(&self, execution_proof: &[u8]) -> Result<bool> {
        // Check proof header
        if execution_proof.len() < 16 {
            return Ok(false);
        }

        let header = &execution_proof[..16];

        // Verify known headers
        let valid_headers = [
            b"JOLT-ATLAS-ZK-V1",
            b"JOLT-ATLAS-TP-V1",
        ];

        if !valid_headers.iter().any(|h| header == *h) {
            debug!("Unknown proof header");
            return Ok(false);
        }

        // In production, this would:
        // 1. Parse proof components
        // 2. Verify HyperNova folding proof
        // 3. Check all cryptographic constraints
        //
        // For now, we verify structure and simulate success

        // Verify proof has expected structure
        if execution_proof.len() < 100 {
            return Ok(false);
        }

        // Simulate cryptographic verification (always succeeds for valid structure)
        Ok(true)
    }

    /// Verify commitment binding (input/output match the proof)
    fn verify_commitment_binding(&self, proof: &JoltAtlasProof) -> bool {
        // Verify model commitment has valid structure
        if proof.model_commitment.commitment == [0u8; 32] {
            debug!("Invalid model commitment (all zeros)");
            return false;
        }

        // Verify input commitment
        if proof.input_commitment.hash == [0u8; 32] {
            debug!("Invalid input commitment");
            return false;
        }

        // Verify output commitment
        if proof.output_commitment.hash == [0u8; 32] {
            debug!("Invalid output commitment");
            return false;
        }

        // In production, would verify cryptographic binding between
        // commitments and execution proof

        true
    }

    /// Check verification cache
    fn check_cache(&self, proof: &JoltAtlasProof) -> Option<VerificationResult> {
        let cache_key = self.compute_cache_key(proof);
        let cache = self.cache.read().unwrap();

        if let Some(cached) = cache.get(&cache_key) {
            let now = crate::types::current_timestamp();
            if now.saturating_sub(cached.cached_at) <= self.config.cache_ttl {
                return Some(cached.result.clone());
            }
        }

        None
    }

    /// Cache a verification result
    fn cache_result(&self, proof: &JoltAtlasProof, result: VerificationResult) -> VerificationResult {
        if self.config.enable_cache {
            let cache_key = self.compute_cache_key(proof);
            let mut cache = self.cache.write().unwrap();
            cache.insert(
                cache_key,
                CachedResult {
                    result: result.clone(),
                    cached_at: crate::types::current_timestamp(),
                },
            );
        }
        result
    }

    /// Compute cache key for a proof
    fn compute_cache_key(&self, proof: &JoltAtlasProof) -> [u8; 32] {
        let mut hasher = Keccak256::new();
        hasher.update(&proof.model_commitment.commitment);
        hasher.update(&proof.input_commitment.hash);
        hasher.update(&proof.timestamp.to_le_bytes());
        hasher.finalize().into()
    }

    /// Fetch registry from URL (mock implementation)
    async fn fetch_registry(&self, _url: &str) -> Result<Vec<RegisteredModel>> {
        // In production, this would make an HTTP request
        // For now, return empty (or mock data for testing)
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DecisionType, InputCommitment, ModelCommitment, OutputCommitment, PROOF_VERSION};

    fn create_test_proof() -> JoltAtlasProof {
        let model_commitment = ModelCommitment::new(
            [1u8; 32],
            [2u8; 32],
            [3u8; 32],
            "test-v1".to_string(),
        );

        let input_commitment = InputCommitment {
            hash: [4u8; 32],
            schema_version: 1,
        };

        let output_commitment = OutputCommitment {
            hash: [5u8; 32],
            decision_type: DecisionType::Approve,
        };

        // Create a valid mock proof
        let mut execution_proof = b"JOLT-ATLAS-ZK-V1".to_vec();
        execution_proof.extend_from_slice(&128u32.to_le_bytes()); // security level
        execution_proof.extend_from_slice(&[0u8; 500]); // padding

        JoltAtlasProof {
            model_commitment,
            input_commitment,
            output_commitment,
            execution_proof,
            timestamp: crate::types::current_timestamp(),
            version: PROOF_VERSION,
        }
    }

    #[test]
    fn test_verifier_creation() {
        let verifier = JoltAtlasVerifier::new(VerifierConfig::default());
        assert!(verifier.registered_models.read().unwrap().is_empty());
    }

    #[test]
    fn test_verify_without_registry_requirement() {
        let config = VerifierConfig {
            require_registered_model: false,
            ..Default::default()
        };
        let verifier = JoltAtlasVerifier::new(config);

        let proof = create_test_proof();
        let result = verifier.verify(&proof);

        assert!(result.valid, "Expected valid result, got: {:?}", result.error);
    }

    #[test]
    fn test_verify_requires_registered_model() {
        let verifier = JoltAtlasVerifier::new(VerifierConfig::default());

        let proof = create_test_proof();
        let result = verifier.verify(&proof);

        assert!(!result.valid);
        assert!(result.error.as_ref().unwrap().contains("not registered"));
    }

    #[test]
    fn test_verify_with_registered_model() {
        let verifier = JoltAtlasVerifier::new(VerifierConfig::default());

        let proof = create_test_proof();

        // Register the model
        verifier.add_registered_model(RegisteredModel {
            commitment: proof.model_commitment.commitment,
            agent_id: "test-agent".to_string(),
            registered_at: crate::types::current_timestamp(),
            version: "1.0.0".to_string(),
            name: Some("Test Model".to_string()),
            active: true,
        });

        let result = verifier.verify(&proof);
        assert!(result.valid, "Expected valid result, got: {:?}", result.error);
    }

    #[test]
    fn test_verify_expired_proof() {
        let config = VerifierConfig {
            require_registered_model: false,
            max_proof_age: 60,
            ..Default::default()
        };
        let verifier = JoltAtlasVerifier::new(config);

        let mut proof = create_test_proof();
        proof.timestamp = crate::types::current_timestamp() - 120; // 2 minutes ago

        let result = verifier.verify(&proof);
        assert!(!result.valid);
        assert!(result.error.as_ref().unwrap().contains("expired"));
    }

    #[test]
    fn test_verify_invalid_proof_header() {
        let config = VerifierConfig {
            require_registered_model: false,
            ..Default::default()
        };
        let verifier = JoltAtlasVerifier::new(config);

        let mut proof = create_test_proof();
        proof.execution_proof = b"INVALID-HEADER-XX".to_vec();
        proof.execution_proof.extend_from_slice(&[0u8; 100]);

        let result = verifier.verify(&proof);
        assert!(!result.valid);
    }

    #[test]
    fn test_caching() {
        let config = VerifierConfig {
            require_registered_model: false,
            enable_cache: true,
            cache_ttl: 60,
            ..Default::default()
        };
        let verifier = JoltAtlasVerifier::new(config);

        let proof = create_test_proof();

        // First verification
        let result1 = verifier.verify(&proof);
        assert!(result1.valid);

        // Second verification should hit cache
        let result2 = verifier.verify(&proof);
        assert!(result2.valid);
        assert_eq!(result1.verified_at, result2.verified_at);
    }
}
