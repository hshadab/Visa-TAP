//! JOLT-Atlas proof generation
//!
//! Generates zero-knowledge proofs that a specific ML model produced
//! a specific output from a specific input.
//!
//! # WARNING: Mock Implementation
//!
//! This module currently contains **mock implementations** for demonstration purposes.
//! The following functions do NOT perform real cryptographic operations:
//!
//! - `execute_inference()` - Returns deterministic mock outputs, not actual ML inference
//! - `generate_zk_proof()` - Creates mock proof structure, not real ZK proofs
//! - `generate_transparent_proof()` - Creates mock transparent proofs
//!
//! **DO NOT USE IN PRODUCTION** without integrating real:
//! - ONNX Runtime or equivalent for model inference
//! - JOLT/HyperNova for actual ZK proof generation
//!
//! See the `real-inference` feature flag for production integration points.

use crate::{
    CommitmentGenerator, DecisionType, Error, InferenceOutput, InputCommitment, JoltAtlasProof,
    ModelCommitment, OutputCommitment, ProofConfig, ProvingParams, Result, PROOF_VERSION,
};
use rayon::prelude::*;
use sha3::{Digest, Keccak256};
use std::path::Path;
use std::time::Instant;
use tracing::{debug, info, instrument, warn};

/// JOLT-Atlas prover for generating zkML proofs
///
/// # Example
/// ```rust,ignore
/// use zkml_jolt::{JoltAtlas, ProofConfig};
///
/// let prover = JoltAtlas::new("model.onnx")?;
/// let proof = prover.prove(input_data, &ProofConfig::default())?;
/// ```
pub struct JoltAtlas {
    /// Loaded model data
    model: LoadedModel,

    /// Pre-computed model commitment
    commitment: ModelCommitment,

    /// Prover configuration
    config: ProverConfig,
}

/// Internal representation of a loaded model
struct LoadedModel {
    /// Raw model bytes
    bytes: Vec<u8>,

    /// Model format
    format: ModelFormat,

    /// Path to model file (if loaded from file)
    path: Option<std::path::PathBuf>,
}

/// Supported model formats
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModelFormat {
    Onnx,
    TensorFlow,
    PyTorch,
}

/// Internal prover configuration
#[derive(Debug, Clone)]
struct ProverConfig {
    /// Number of threads for parallel proving
    num_threads: usize,

    /// Enable debug output
    debug: bool,
}

impl Default for ProverConfig {
    fn default() -> Self {
        Self {
            num_threads: num_cpus::get(),
            debug: false,
        }
    }
}

impl JoltAtlas {
    /// Create a new prover instance from a model file
    ///
    /// The model commitment is automatically computed from the file.
    #[instrument(skip_all, fields(path = %model_path.as_ref().display()))]
    pub fn new(model_path: impl AsRef<Path>) -> Result<Self> {
        let path = model_path.as_ref();
        info!("Loading model from {:?}", path);

        let bytes = std::fs::read(path)?;
        let format = Self::detect_format(path)?;
        let commitment = Self::generate_commitment(&bytes, format)?;

        Ok(Self {
            model: LoadedModel {
                bytes,
                format,
                path: Some(path.to_path_buf()),
            },
            commitment,
            config: ProverConfig::default(),
        })
    }

    /// Create a prover with a pre-registered model commitment
    ///
    /// The commitment is verified to match the model file.
    #[instrument(skip_all)]
    pub fn with_commitment(
        model_path: impl AsRef<Path>,
        commitment: ModelCommitment,
    ) -> Result<Self> {
        let path = model_path.as_ref();
        let bytes = std::fs::read(path)?;
        let format = Self::detect_format(path)?;

        // Verify commitment matches
        let computed = Self::generate_commitment(&bytes, format)?;
        if computed.commitment != commitment.commitment {
            return Err(Error::CommitmentMismatch {
                expected: hex::encode(commitment.commitment),
                actual: hex::encode(computed.commitment),
            });
        }

        Ok(Self {
            model: LoadedModel {
                bytes,
                format,
                path: Some(path.to_path_buf()),
            },
            commitment,
            config: ProverConfig::default(),
        })
    }

    /// Create a prover from raw model bytes
    pub fn from_bytes(bytes: Vec<u8>, format: ModelFormat) -> Result<Self> {
        let commitment = Self::generate_commitment(&bytes, format)?;

        Ok(Self {
            model: LoadedModel {
                bytes,
                format,
                path: None,
            },
            commitment,
            config: ProverConfig::default(),
        })
    }

    /// Get the model commitment
    pub fn commitment(&self) -> &ModelCommitment {
        &self.commitment
    }

    /// Generate a zkML proof for the given input
    ///
    /// # Arguments
    /// * `input` - The input data (transaction context)
    /// * `config` - Proof generation configuration
    ///
    /// # Returns
    /// A `JoltAtlasProof` that can be verified by any party
    #[instrument(skip_all, fields(input_len = input.len(), zk = config.zero_knowledge))]
    pub fn prove(&self, input: &[u8], config: &ProofConfig) -> Result<JoltAtlasProof> {
        let start = Instant::now();
        info!("Starting proof generation");

        // 1. Generate input commitment
        let input_commitment = InputCommitment::from_bytes(input);
        debug!("Input commitment: {}", input_commitment.hash_hex());

        // 2. Execute model inference
        let (output, execution_trace) = self.execute_inference(input)?;
        debug!("Inference complete, decision: {:?}", output.decision_type);

        // 3. Generate output commitment
        let output_commitment = OutputCommitment::from_inference_result(&output);

        // 4. Generate JOLT proof
        let execution_proof = if config.zero_knowledge {
            self.generate_zk_proof(&execution_trace, config.proving_params.as_ref())?
        } else {
            self.generate_transparent_proof(&execution_trace)?
        };

        let proof = JoltAtlasProof {
            model_commitment: self.commitment.clone(),
            input_commitment,
            output_commitment,
            execution_proof,
            timestamp: crate::types::current_timestamp(),
            version: PROOF_VERSION,
        };

        let elapsed = start.elapsed();
        info!("Proof generated in {:?}", elapsed);

        Ok(proof)
    }

    /// Generate proofs for multiple inputs in parallel
    #[instrument(skip_all, fields(batch_size = inputs.len()))]
    pub fn prove_batch(&self, inputs: &[&[u8]], config: &ProofConfig) -> Result<Vec<JoltAtlasProof>> {
        info!("Starting batch proof generation for {} inputs", inputs.len());
        let start = Instant::now();

        let results: Result<Vec<_>> = inputs
            .par_iter()
            .map(|input| self.prove(input, config))
            .collect();

        let proofs = results?;

        info!(
            "Batch proof generation complete in {:?}",
            start.elapsed()
        );

        Ok(proofs)
    }

    /// Execute model inference and capture execution trace
    ///
    /// # Warning
    ///
    /// This is a **MOCK IMPLEMENTATION** that returns deterministic fake outputs.
    /// It does NOT run actual model inference.
    ///
    /// For production use, integrate with:
    /// - `onnxruntime` crate for ONNX models
    /// - `tensorflow` crate for TensorFlow models
    /// - `tch` crate for PyTorch models
    #[cfg(not(feature = "real-inference"))]
    fn execute_inference(&self, input: &[u8]) -> Result<(InferenceOutput, ExecutionTrace)> {
        // Log warning on first use
        static WARNED: std::sync::Once = std::sync::Once::new();
        WARNED.call_once(|| {
            warn!(
                "MOCK INFERENCE: Using simulated model inference. \
                 This is NOT suitable for production. \
                 Enable 'real-inference' feature for actual ML execution."
            );
        });

        let mut hasher = Keccak256::new();
        hasher.update(&self.model.bytes);
        hasher.update(input);
        let result_hash: [u8; 32] = hasher.finalize().into();

        // Deterministic decision based on hash
        let decision_type = match result_hash[0] % 4 {
            0 => DecisionType::Approve,
            1 => DecisionType::Deny,
            2 => DecisionType::Escalate,
            _ => DecisionType::Defer,
        };

        let confidence = (result_hash[1] as f64) / 255.0;

        let output = InferenceOutput {
            decision_type,
            confidence,
            reason_code: None,
            raw_output: Some(result_hash.iter().map(|&b| b as f32 / 255.0).collect()),
        };

        // Create execution trace (simplified)
        let trace = ExecutionTrace {
            steps: vec![result_hash.to_vec()],
            intermediate_hashes: vec![result_hash],
        };

        Ok((output, trace))
    }

    /// Generate zero-knowledge proof using HyperNova
    ///
    /// # Warning
    ///
    /// This is a **MOCK IMPLEMENTATION** that creates fake proof structures.
    /// It does NOT generate real cryptographic proofs.
    ///
    /// For production use, integrate with actual JOLT/HyperNova implementation.
    #[cfg(not(feature = "real-inference"))]
    fn generate_zk_proof(
        &self,
        trace: &ExecutionTrace,
        params: Option<&ProvingParams>,
    ) -> Result<Vec<u8>> {
        let params = params.cloned().unwrap_or_default();
        debug!(
            "MOCK: Generating fake ZK proof with security level {}",
            params.security_level
        );

        // WARNING: This generates FAKE proofs that can be trivially forged.
        // Real implementation would:
        // 1. Convert execution trace to R1CS constraints
        // 2. Apply HyperNova folding scheme
        // 3. Generate cryptographically secure succinct proof

        let mut proof_data = Vec::new();

        // Proof header
        proof_data.extend_from_slice(b"JOLT-ATLAS-ZK-V1");

        // Security parameter
        proof_data.extend_from_slice(&params.security_level.to_le_bytes());

        // Commitment to trace
        let mut hasher = Keccak256::new();
        for step in &trace.steps {
            hasher.update(step);
        }
        proof_data.extend_from_slice(&hasher.finalize());

        // Simulated proof components (in production: actual cryptographic data)
        proof_data.extend_from_slice(&[0u8; 128]); // Commitment
        proof_data.extend_from_slice(&[0u8; 256]); // Response
        proof_data.extend_from_slice(&[0u8; 64]); // Auxiliary

        // Add some randomness to simulate real proof variance
        let mut rng_seed = Keccak256::new();
        rng_seed.update(&proof_data);
        rng_seed.update(&crate::types::current_timestamp().to_le_bytes());
        proof_data.extend_from_slice(&rng_seed.finalize());

        Ok(proof_data)
    }

    /// Generate transparent (non-ZK) proof
    fn generate_transparent_proof(&self, trace: &ExecutionTrace) -> Result<Vec<u8>> {
        debug!("Generating transparent proof");

        let mut proof_data = Vec::new();

        // Proof header
        proof_data.extend_from_slice(b"JOLT-ATLAS-TP-V1");

        // Include full trace (not privacy preserving)
        for step in &trace.steps {
            proof_data.extend_from_slice(&(step.len() as u32).to_le_bytes());
            proof_data.extend_from_slice(step);
        }

        Ok(proof_data)
    }

    /// Detect model format from file extension
    fn detect_format(path: &Path) -> Result<ModelFormat> {
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        match extension.to_lowercase().as_str() {
            "onnx" => Ok(ModelFormat::Onnx),
            "pb" => Ok(ModelFormat::TensorFlow),
            "pt" | "pth" => Ok(ModelFormat::PyTorch),
            _ => Err(Error::UnsupportedFormat(extension.to_string())),
        }
    }

    /// Generate commitment for model bytes
    fn generate_commitment(bytes: &[u8], format: ModelFormat) -> Result<ModelCommitment> {
        match format {
            ModelFormat::Onnx => CommitmentGenerator::from_onnx_bytes(bytes),
            ModelFormat::TensorFlow => {
                CommitmentGenerator::from_components(bytes, b"tensorflow_v2", "1.0.0")
            }
            ModelFormat::PyTorch => {
                CommitmentGenerator::from_components(bytes, b"pytorch_v2", "1.0.0")
            }
        }
    }
}

/// Execution trace for proof generation
struct ExecutionTrace {
    /// Execution steps
    steps: Vec<Vec<u8>>,

    /// Intermediate hashes for verification
    intermediate_hashes: Vec<[u8; 32]>,
}

// Re-export for convenience
pub use num_cpus;

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_model() -> NamedTempFile {
        let mut file = NamedTempFile::with_suffix(".onnx").unwrap();
        file.write_all(b"FAKE ONNX MODEL DATA FOR TESTING PURPOSES ONLY").unwrap();
        file
    }

    #[test]
    fn test_prover_creation() {
        let model_file = create_test_model();
        let prover = JoltAtlas::new(model_file.path()).unwrap();

        assert!(!prover.commitment().commitment_hex().is_empty());
    }

    #[test]
    fn test_proof_generation() {
        let model_file = create_test_model();
        let prover = JoltAtlas::new(model_file.path()).unwrap();

        let input = b"test transaction context";
        let config = ProofConfig::default();

        let proof = prover.prove(input, &config).unwrap();

        assert!(!proof.execution_proof.is_empty());
        assert!(proof.timestamp > 0);
        assert_eq!(proof.version, PROOF_VERSION);
    }

    #[test]
    fn test_proof_determinism_same_input() {
        let model_file = create_test_model();
        let prover = JoltAtlas::new(model_file.path()).unwrap();

        let input = b"same input";
        let config = ProofConfig::transparent(); // Transparent for determinism

        let proof1 = prover.prove(input, &config).unwrap();
        let proof2 = prover.prove(input, &config).unwrap();

        // Input and output commitments should be the same
        assert_eq!(proof1.input_commitment.hash, proof2.input_commitment.hash);
        assert_eq!(
            proof1.output_commitment.decision_type,
            proof2.output_commitment.decision_type
        );
    }

    #[test]
    fn test_commitment_verification() {
        let model_file = create_test_model();
        let prover1 = JoltAtlas::new(model_file.path()).unwrap();
        let commitment = prover1.commitment().clone();

        // Should succeed with matching commitment
        let prover2 = JoltAtlas::with_commitment(model_file.path(), commitment).unwrap();
        assert_eq!(prover1.commitment().commitment, prover2.commitment().commitment);
    }

    #[test]
    fn test_commitment_mismatch() {
        let model_file = create_test_model();

        // Create a fake commitment
        let fake_commitment = ModelCommitment::new(
            [1u8; 32],
            [2u8; 32],
            [3u8; 32],
            "fake".to_string(),
        );

        let result = JoltAtlas::with_commitment(model_file.path(), fake_commitment);
        assert!(matches!(result, Err(Error::CommitmentMismatch { .. })));
    }
}
