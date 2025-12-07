//! Payment container extensions for zkML
//!
//! Extends TAP Payment Containers with zkML proof capabilities.

use serde::{Deserialize, Serialize};
use zkml_jolt::JoltAtlasProof;

/// Extended TAP Payment Container with zkML support
///
/// This wraps the standard TAP payment container with optional
/// zkML proof for high-value transactions.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkmlPaymentContainer {
    /// Transaction amount in cents
    pub amount: u64,

    /// Currency code (e.g., "USD")
    pub currency: String,

    /// Merchant identifier
    pub merchant_id: String,

    /// Agent intent description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_intent: Option<String>,

    /// Consumer identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub consumer_id: Option<String>,

    /// zkML proof (if required for this transaction)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zkml_proof: Option<ZkmlProofContainer>,

    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Container for zkML proof within payment container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZkmlProofContainer {
    /// The zkML proof
    pub proof: JoltAtlasProof,

    /// Threshold that triggered proof requirement (cents)
    pub threshold: u64,

    /// Whether proof was verified at time of creation
    pub pre_verified: bool,
}

impl ZkmlPaymentContainer {
    /// Create a new payment container
    pub fn new(amount: u64, currency: impl Into<String>, merchant_id: impl Into<String>) -> Self {
        Self {
            amount,
            currency: currency.into(),
            merchant_id: merchant_id.into(),
            agent_intent: None,
            consumer_id: None,
            zkml_proof: None,
            metadata: None,
        }
    }

    /// Builder: Set agent intent
    pub fn with_intent(mut self, intent: impl Into<String>) -> Self {
        self.agent_intent = Some(intent.into());
        self
    }

    /// Builder: Set consumer ID
    pub fn with_consumer(mut self, consumer_id: impl Into<String>) -> Self {
        self.consumer_id = Some(consumer_id.into());
        self
    }

    /// Builder: Add zkML proof
    pub fn with_proof(mut self, proof: JoltAtlasProof, threshold: u64) -> Self {
        self.zkml_proof = Some(ZkmlProofContainer {
            proof,
            threshold,
            pre_verified: false,
        });
        self
    }

    /// Builder: Add pre-verified zkML proof
    pub fn with_verified_proof(mut self, proof: JoltAtlasProof, threshold: u64) -> Self {
        self.zkml_proof = Some(ZkmlProofContainer {
            proof,
            threshold,
            pre_verified: true,
        });
        self
    }

    /// Builder: Add metadata
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }

    /// Check if zkML proof is required based on threshold
    pub fn requires_proof(&self, threshold_cents: u64) -> bool {
        self.amount >= threshold_cents
    }

    /// Check if container has a zkML proof
    pub fn has_proof(&self) -> bool {
        self.zkml_proof.is_some()
    }

    /// Get the zkML proof if present
    pub fn proof(&self) -> Option<&JoltAtlasProof> {
        self.zkml_proof.as_ref().map(|c| &c.proof)
    }

    /// Get amount in dollars
    pub fn amount_dollars(&self) -> f64 {
        self.amount as f64 / 100.0
    }

    /// Convert to inference input bytes
    ///
    /// Creates a deterministic byte representation for model inference.
    pub fn to_inference_input(&self) -> Vec<u8> {
        // Create a structured input for the model
        let input = InferenceInput {
            amount: self.amount,
            currency: self.currency.clone(),
            merchant_id: self.merchant_id.clone(),
            intent: self.agent_intent.clone(),
        };

        serde_json::to_vec(&input).unwrap_or_default()
    }

    /// Serialize container to JSON
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserialize container from JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

/// Input structure for model inference
#[derive(Debug, Serialize, Deserialize)]
struct InferenceInput {
    amount: u64,
    currency: String,
    merchant_id: String,
    intent: Option<String>,
}

/// Verification status for a payment container
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerVerificationResult {
    /// TAP signature verification result
    pub tap_signature: SignatureResult,

    /// zkML proof verification result
    pub zkml_proof: ZkmlResult,

    /// Overall verification status
    pub verified: bool,
}

/// TAP signature verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureResult {
    /// Whether the signature is valid
    pub valid: bool,

    /// Agent ID from signature
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,

    /// Error message if invalid
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// zkML verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum ZkmlResult {
    /// Proof verified successfully
    Verified {
        /// Model commitment
        model_commitment: String,
    },

    /// Proof not required for this transaction
    NotRequired,

    /// Proof required but missing
    Missing,

    /// Proof verification failed
    Failed {
        /// Error message
        error: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_container_builder() {
        let container = ZkmlPaymentContainer::new(150000, "USD", "merchant-123")
            .with_intent("Purchase electronics")
            .with_consumer("consumer-456");

        assert_eq!(container.amount, 150000);
        assert_eq!(container.currency, "USD");
        assert_eq!(container.agent_intent.as_deref(), Some("Purchase electronics"));
        assert!(!container.has_proof());
    }

    #[test]
    fn test_requires_proof() {
        let container = ZkmlPaymentContainer::new(150000, "USD", "merchant-123"); // $1500

        // Default threshold is $1000 = 100000 cents
        assert!(container.requires_proof(100000));
        assert!(!container.requires_proof(200000));
    }

    #[test]
    fn test_amount_dollars() {
        let container = ZkmlPaymentContainer::new(150075, "USD", "merchant-123");
        assert!((container.amount_dollars() - 1500.75).abs() < 0.001);
    }

    #[test]
    fn test_inference_input() {
        let container = ZkmlPaymentContainer::new(100000, "USD", "merchant-123")
            .with_intent("Test purchase");

        let input = container.to_inference_input();
        assert!(!input.is_empty());

        // Should be valid JSON
        let parsed: serde_json::Value = serde_json::from_slice(&input).unwrap();
        assert_eq!(parsed["amount"], 100000);
        assert_eq!(parsed["currency"], "USD");
    }

    #[test]
    fn test_json_roundtrip() {
        let container = ZkmlPaymentContainer::new(100000, "USD", "merchant-123")
            .with_intent("Test")
            .with_consumer("consumer-1");

        let json = container.to_json().unwrap();
        let decoded = ZkmlPaymentContainer::from_json(&json).unwrap();

        assert_eq!(container.amount, decoded.amount);
        assert_eq!(container.merchant_id, decoded.merchant_id);
        assert_eq!(container.agent_intent, decoded.agent_intent);
    }
}
