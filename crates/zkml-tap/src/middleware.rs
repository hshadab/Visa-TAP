//! HTTP middleware for zkML verification
//!
//! Provides middleware components for verifying zkML proofs in HTTP requests.

use crate::headers::{ZkmlHeaderInfo, ZkmlHeaders};
use crate::container::{ContainerVerificationResult, SignatureResult, ZkmlResult};
use http::HeaderMap;
use std::sync::Arc;
use tracing::{debug, info, warn};
use zkml_jolt::{JoltAtlasProof, JoltAtlasVerifier, VerifierConfig};

/// Configuration for zkML middleware
#[derive(Debug, Clone)]
pub struct ZkmlMiddlewareConfig {
    /// USD threshold for requiring zkML proof (in cents)
    pub threshold_cents: u64,

    /// Verifier configuration
    pub verifier_config: VerifierConfig,

    /// Whether to block requests with missing required proofs
    pub block_missing_proofs: bool,

    /// Whether to block requests with invalid proofs
    pub block_invalid_proofs: bool,

    /// Enable debug logging
    pub debug: bool,
}

impl Default for ZkmlMiddlewareConfig {
    fn default() -> Self {
        Self {
            threshold_cents: 100_000, // $1000
            verifier_config: VerifierConfig::default(),
            block_missing_proofs: true,
            block_invalid_proofs: true,
            debug: false,
        }
    }
}

impl ZkmlMiddlewareConfig {
    /// Create a permissive config for development
    pub fn development() -> Self {
        Self {
            threshold_cents: 100_000,
            verifier_config: VerifierConfig::permissive(),
            block_missing_proofs: false,
            block_invalid_proofs: false,
            debug: true,
        }
    }

    /// Create a strict config for production
    pub fn production() -> Self {
        Self {
            threshold_cents: 100_000,
            verifier_config: VerifierConfig::strict(),
            block_missing_proofs: true,
            block_invalid_proofs: true,
            debug: false,
        }
    }
}

/// zkML verification middleware
///
/// Verifies zkML proofs in incoming HTTP requests for transactions
/// above the configured threshold.
pub struct ZkmlMiddleware {
    /// Middleware configuration
    config: ZkmlMiddlewareConfig,

    /// Proof verifier
    verifier: Arc<JoltAtlasVerifier>,
}

impl ZkmlMiddleware {
    /// Create new middleware with configuration
    pub fn new(config: ZkmlMiddlewareConfig) -> Self {
        let verifier = JoltAtlasVerifier::new(config.verifier_config.clone());

        Self {
            config,
            verifier: Arc::new(verifier),
        }
    }

    /// Create middleware with default configuration
    pub fn default_middleware() -> Self {
        Self::new(ZkmlMiddlewareConfig::default())
    }

    /// Get the verifier for registering models
    pub fn verifier(&self) -> &JoltAtlasVerifier {
        &self.verifier
    }

    /// Verify zkML proof from HTTP headers
    ///
    /// # Arguments
    /// * `headers` - HTTP headers containing zkML proof
    /// * `transaction_amount_cents` - Transaction amount in cents
    ///
    /// # Returns
    /// Verification result indicating whether request should proceed
    pub fn verify_request(
        &self,
        headers: &HeaderMap,
        transaction_amount_cents: u64,
    ) -> ZkmlVerificationOutcome {
        // Check if proof is required
        let proof_required = transaction_amount_cents >= self.config.threshold_cents;

        if self.config.debug {
            debug!(
                "Verifying request: amount={} threshold={} required={}",
                transaction_amount_cents, self.config.threshold_cents, proof_required
            );
        }

        // If proof not required, allow request
        if !proof_required {
            return ZkmlVerificationOutcome::NotRequired;
        }

        // Check if proof is present
        if !headers.has_zkml_proof() {
            if self.config.block_missing_proofs {
                warn!("zkML proof required but missing for ${:.2} transaction",
                    transaction_amount_cents as f64 / 100.0);
                return ZkmlVerificationOutcome::MissingProof;
            } else {
                return ZkmlVerificationOutcome::SkippedMissing;
            }
        }

        // Extract and verify proof
        match headers.get_zkml_proof() {
            Ok(Some(proof)) => self.verify_proof(&proof),
            Ok(None) => {
                // Shouldn't happen since we checked has_zkml_proof
                ZkmlVerificationOutcome::MissingProof
            }
            Err(e) => {
                warn!("Failed to decode zkML proof: {}", e);
                if self.config.block_invalid_proofs {
                    ZkmlVerificationOutcome::InvalidProof(e.to_string())
                } else {
                    ZkmlVerificationOutcome::SkippedInvalid(e.to_string())
                }
            }
        }
    }

    /// Verify a decoded proof
    fn verify_proof(&self, proof: &JoltAtlasProof) -> ZkmlVerificationOutcome {
        let result = self.verifier.verify(proof);

        if result.valid {
            info!(
                "zkML proof verified: model={}",
                hex::encode(&result.model_commitment[..8])
            );
            ZkmlVerificationOutcome::Verified {
                model_commitment: hex::encode(&result.model_commitment),
            }
        } else {
            let error = result.error.unwrap_or_else(|| "Unknown error".to_string());
            warn!("zkML proof verification failed: {}", error);

            if self.config.block_invalid_proofs {
                ZkmlVerificationOutcome::InvalidProof(error)
            } else {
                ZkmlVerificationOutcome::SkippedInvalid(error)
            }
        }
    }

    /// Create verification result for response
    pub fn create_result(
        &self,
        outcome: &ZkmlVerificationOutcome,
        tap_valid: bool,
        agent_id: Option<String>,
    ) -> ContainerVerificationResult {
        let tap_signature = SignatureResult {
            valid: tap_valid,
            agent_id,
            error: if tap_valid { None } else { Some("TAP signature invalid".to_string()) },
        };

        let zkml_proof = match outcome {
            ZkmlVerificationOutcome::Verified { model_commitment } => {
                ZkmlResult::Verified { model_commitment: model_commitment.clone() }
            }
            ZkmlVerificationOutcome::NotRequired => ZkmlResult::NotRequired,
            ZkmlVerificationOutcome::MissingProof => ZkmlResult::Missing,
            ZkmlVerificationOutcome::InvalidProof(e) => ZkmlResult::Failed { error: e.clone() },
            ZkmlVerificationOutcome::SkippedMissing => ZkmlResult::Missing,
            ZkmlVerificationOutcome::SkippedInvalid(e) => ZkmlResult::Failed { error: e.clone() },
        };

        let verified = tap_valid && outcome.is_success();

        ContainerVerificationResult {
            tap_signature,
            zkml_proof,
            verified,
        }
    }
}

/// Outcome of zkML verification
#[derive(Debug, Clone)]
pub enum ZkmlVerificationOutcome {
    /// Proof verified successfully
    Verified {
        /// Hex-encoded model commitment
        model_commitment: String,
    },

    /// Proof not required (transaction below threshold)
    NotRequired,

    /// Proof required but missing (blocked)
    MissingProof,

    /// Proof present but invalid (blocked)
    InvalidProof(String),

    /// Proof missing but not blocked (development mode)
    SkippedMissing,

    /// Proof invalid but not blocked (development mode)
    SkippedInvalid(String),
}

impl ZkmlVerificationOutcome {
    /// Check if verification was successful (request should proceed)
    pub fn is_success(&self) -> bool {
        matches!(
            self,
            ZkmlVerificationOutcome::Verified { .. }
                | ZkmlVerificationOutcome::NotRequired
                | ZkmlVerificationOutcome::SkippedMissing
                | ZkmlVerificationOutcome::SkippedInvalid(_)
        )
    }

    /// Check if request should be blocked
    pub fn should_block(&self) -> bool {
        matches!(
            self,
            ZkmlVerificationOutcome::MissingProof | ZkmlVerificationOutcome::InvalidProof(_)
        )
    }

    /// Get error message if verification failed
    pub fn error_message(&self) -> Option<&str> {
        match self {
            ZkmlVerificationOutcome::MissingProof => {
                Some("zkML proof required for transactions above threshold")
            }
            ZkmlVerificationOutcome::InvalidProof(e) => Some(e),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_middleware_creation() {
        let middleware = ZkmlMiddleware::new(ZkmlMiddlewareConfig::default());
        assert_eq!(middleware.config.threshold_cents, 100_000);
    }

    #[test]
    fn test_below_threshold() {
        let middleware = ZkmlMiddleware::new(ZkmlMiddlewareConfig::default());
        let headers = HeaderMap::new();

        let result = middleware.verify_request(&headers, 50_000); // $500

        assert!(matches!(result, ZkmlVerificationOutcome::NotRequired));
        assert!(result.is_success());
    }

    #[test]
    fn test_above_threshold_missing_proof() {
        let middleware = ZkmlMiddleware::new(ZkmlMiddlewareConfig::default());
        let headers = HeaderMap::new();

        let result = middleware.verify_request(&headers, 150_000); // $1500

        assert!(matches!(result, ZkmlVerificationOutcome::MissingProof));
        assert!(result.should_block());
    }

    #[test]
    fn test_development_mode_allows_missing() {
        let middleware = ZkmlMiddleware::new(ZkmlMiddlewareConfig::development());
        let headers = HeaderMap::new();

        let result = middleware.verify_request(&headers, 150_000); // $1500

        assert!(matches!(result, ZkmlVerificationOutcome::SkippedMissing));
        assert!(result.is_success());
    }

    #[test]
    fn test_verification_outcome_success() {
        let verified = ZkmlVerificationOutcome::Verified {
            model_commitment: "abc123".to_string(),
        };
        assert!(verified.is_success());
        assert!(!verified.should_block());

        let not_required = ZkmlVerificationOutcome::NotRequired;
        assert!(not_required.is_success());
    }

    #[test]
    fn test_verification_outcome_failure() {
        let missing = ZkmlVerificationOutcome::MissingProof;
        assert!(!missing.is_success());
        assert!(missing.should_block());
        assert!(missing.error_message().is_some());

        let invalid = ZkmlVerificationOutcome::InvalidProof("test error".to_string());
        assert!(!invalid.is_success());
        assert!(invalid.should_block());
    }
}
