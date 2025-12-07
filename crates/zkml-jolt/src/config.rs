//! Configuration types for JOLT-Atlas

use serde::{Deserialize, Serialize};

/// Proof configuration options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofConfig {
    /// Enable zero-knowledge mode (hide model weights/inputs)
    pub zero_knowledge: bool,

    /// Pre-registered model commitment for binding verification
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_commitment: Option<crate::ModelCommitment>,

    /// Transaction threshold that triggered proof requirement (USD)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub threshold: Option<u64>,

    /// Custom proving parameters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proving_params: Option<ProvingParams>,
}

impl Default for ProofConfig {
    fn default() -> Self {
        Self {
            zero_knowledge: true,
            model_commitment: None,
            threshold: Some(crate::DEFAULT_THRESHOLD),
            proving_params: None,
        }
    }
}

impl ProofConfig {
    /// Create a new proof config with zero-knowledge enabled
    pub fn zk() -> Self {
        Self {
            zero_knowledge: true,
            ..Default::default()
        }
    }

    /// Create a proof config without zero-knowledge (faster, but reveals more)
    pub fn transparent() -> Self {
        Self {
            zero_knowledge: false,
            ..Default::default()
        }
    }

    /// Set the model commitment
    pub fn with_commitment(mut self, commitment: crate::ModelCommitment) -> Self {
        self.model_commitment = Some(commitment);
        self
    }

    /// Set the threshold
    pub fn with_threshold(mut self, threshold: u64) -> Self {
        self.threshold = Some(threshold);
        self
    }

    /// Set custom proving parameters
    pub fn with_proving_params(mut self, params: ProvingParams) -> Self {
        self.proving_params = Some(params);
        self
    }
}

/// Proving parameters for fine-tuning proof generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvingParams {
    /// Security level in bits (default: 128)
    pub security_level: u32,

    /// Enable HyperNova folding for efficiency
    pub use_hypernova: bool,

    /// Maximum proof size in bytes (None = unlimited)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_proof_size: Option<usize>,

    /// Number of parallel proving threads (None = auto-detect)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_threads: Option<usize>,
}

impl Default for ProvingParams {
    fn default() -> Self {
        Self {
            security_level: 128,
            use_hypernova: true,
            max_proof_size: None,
            num_threads: None,
        }
    }
}

impl ProvingParams {
    /// Create params for maximum security
    pub fn high_security() -> Self {
        Self {
            security_level: 256,
            use_hypernova: true,
            max_proof_size: None,
            num_threads: None,
        }
    }

    /// Create params for fastest proving (lower security)
    pub fn fast() -> Self {
        Self {
            security_level: 80,
            use_hypernova: true,
            max_proof_size: Some(50_000), // 50KB limit
            num_threads: None,
        }
    }
}

/// Verifier configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifierConfig {
    /// Require model to be in Visa registry
    pub require_registered_model: bool,

    /// Maximum proof age in seconds (default: 300 = 5 minutes)
    pub max_proof_age: u64,

    /// Registry URL for model lookup
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registry_url: Option<String>,

    /// Enable strict mode (reject on any anomaly)
    pub strict_mode: bool,

    /// Cache verification results
    pub enable_cache: bool,

    /// Cache TTL in seconds
    pub cache_ttl: u64,
}

impl Default for VerifierConfig {
    fn default() -> Self {
        Self {
            require_registered_model: true,
            max_proof_age: crate::DEFAULT_MAX_PROOF_AGE,
            registry_url: None,
            strict_mode: false,
            enable_cache: true,
            cache_ttl: 60,
        }
    }
}

impl VerifierConfig {
    /// Create a permissive config (for testing)
    pub fn permissive() -> Self {
        Self {
            require_registered_model: false,
            max_proof_age: 3600, // 1 hour
            registry_url: None,
            strict_mode: false,
            enable_cache: false,
            cache_ttl: 0,
        }
    }

    /// Create a strict production config
    pub fn strict() -> Self {
        Self {
            require_registered_model: true,
            max_proof_age: 60, // 1 minute
            registry_url: Some("https://registry.visa.com/v1/agents/models".to_string()),
            strict_mode: true,
            enable_cache: true,
            cache_ttl: 30,
        }
    }

    /// Set the registry URL
    pub fn with_registry(mut self, url: impl Into<String>) -> Self {
        self.registry_url = Some(url.into());
        self
    }

    /// Set max proof age
    pub fn with_max_age(mut self, seconds: u64) -> Self {
        self.max_proof_age = seconds;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proof_config_defaults() {
        let config = ProofConfig::default();
        assert!(config.zero_knowledge);
        assert_eq!(config.threshold, Some(1000));
    }

    #[test]
    fn test_verifier_config_builder() {
        let config = VerifierConfig::default()
            .with_registry("https://example.com")
            .with_max_age(120);

        assert_eq!(
            config.registry_url.as_deref(),
            Some("https://example.com")
        );
        assert_eq!(config.max_proof_age, 120);
    }
}
