//! HTTP header extensions for zkML proofs
//!
//! Defines the custom HTTP headers used to transmit zkML proofs
//! within TAP Payment Containers.

use http::header::HeaderName;
use http::HeaderMap;
use zkml_jolt::{JoltAtlasProof, Result};

/// Header name for the base64-encoded zkML proof
pub const HEADER_PROOF: &str = "x-zkml-proof";

/// Header name for the hex-encoded model commitment
pub const HEADER_MODEL_COMMITMENT: &str = "x-zkml-model-commitment";

/// Header name for the USD threshold that triggered proof requirement
pub const HEADER_THRESHOLD: &str = "x-zkml-threshold";

/// Header name for the proof generation timestamp
pub const HEADER_TIMESTAMP: &str = "x-zkml-timestamp";

/// Header name for the proof format version
pub const HEADER_VERSION: &str = "x-zkml-version";

/// Extension trait for adding zkML headers to HTTP requests
pub trait ZkmlHeaders {
    /// Add zkML proof headers to the request
    fn set_zkml_proof(&mut self, proof: &JoltAtlasProof) -> Result<()>;

    /// Add zkML proof with threshold information
    fn set_zkml_proof_with_threshold(
        &mut self,
        proof: &JoltAtlasProof,
        threshold: u64,
    ) -> Result<()>;

    /// Extract zkML proof from headers
    fn get_zkml_proof(&self) -> Result<Option<JoltAtlasProof>>;

    /// Get model commitment from headers
    fn get_zkml_model_commitment(&self) -> Option<String>;

    /// Get threshold from headers
    fn get_zkml_threshold(&self) -> Option<u64>;

    /// Get timestamp from headers
    fn get_zkml_timestamp(&self) -> Option<u64>;

    /// Check if zkML headers are present
    fn has_zkml_proof(&self) -> bool;
}

impl ZkmlHeaders for HeaderMap {
    fn set_zkml_proof(&mut self, proof: &JoltAtlasProof) -> Result<()> {
        self.set_zkml_proof_with_threshold(proof, crate::DEFAULT_THRESHOLD)
    }

    fn set_zkml_proof_with_threshold(
        &mut self,
        proof: &JoltAtlasProof,
        threshold: u64,
    ) -> Result<()> {
        // Encode proof as base64
        let proof_base64 = proof.to_base64()?;
        self.insert(
            HeaderName::from_static(HEADER_PROOF),
            proof_base64.parse().map_err(|e| {
                zkml_jolt::Error::Serialization(format!("Invalid header value: {}", e))
            })?,
        );

        // Add model commitment as hex
        let commitment_hex = hex::encode(&proof.model_commitment.commitment);
        self.insert(
            HeaderName::from_static(HEADER_MODEL_COMMITMENT),
            commitment_hex.parse().map_err(|e| {
                zkml_jolt::Error::Serialization(format!("Invalid header value: {}", e))
            })?,
        );

        // Add threshold
        self.insert(
            HeaderName::from_static(HEADER_THRESHOLD),
            threshold.to_string().parse().map_err(|e| {
                zkml_jolt::Error::Serialization(format!("Invalid header value: {}", e))
            })?,
        );

        // Add timestamp
        self.insert(
            HeaderName::from_static(HEADER_TIMESTAMP),
            proof.timestamp.to_string().parse().map_err(|e| {
                zkml_jolt::Error::Serialization(format!("Invalid header value: {}", e))
            })?,
        );

        // Add version
        self.insert(
            HeaderName::from_static(HEADER_VERSION),
            proof.version.to_string().parse().map_err(|e| {
                zkml_jolt::Error::Serialization(format!("Invalid header value: {}", e))
            })?,
        );

        Ok(())
    }

    fn get_zkml_proof(&self) -> Result<Option<JoltAtlasProof>> {
        let Some(encoded) = self.get(HEADER_PROOF) else {
            return Ok(None);
        };

        let encoded_str = encoded
            .to_str()
            .map_err(|e| zkml_jolt::Error::Serialization(format!("Invalid UTF-8: {}", e)))?;

        let proof = JoltAtlasProof::from_base64(encoded_str)?;
        Ok(Some(proof))
    }

    fn get_zkml_model_commitment(&self) -> Option<String> {
        self.get(HEADER_MODEL_COMMITMENT)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
    }

    fn get_zkml_threshold(&self) -> Option<u64> {
        self.get(HEADER_THRESHOLD)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok())
    }

    fn get_zkml_timestamp(&self) -> Option<u64> {
        self.get(HEADER_TIMESTAMP)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok())
    }

    fn has_zkml_proof(&self) -> bool {
        self.contains_key(HEADER_PROOF)
    }
}

/// Extract zkML headers from a hyper Request
pub fn extract_zkml_headers<B>(req: &hyper::Request<B>) -> ZkmlHeaderInfo {
    let headers = req.headers();

    ZkmlHeaderInfo {
        proof: headers.get(HEADER_PROOF).and_then(|v| v.to_str().ok()).map(|s| s.to_string()),
        model_commitment: headers.get_zkml_model_commitment(),
        threshold: headers.get_zkml_threshold(),
        timestamp: headers.get_zkml_timestamp(),
        version: headers
            .get(HEADER_VERSION)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse().ok()),
    }
}

/// Extracted zkML header information
#[derive(Debug, Clone)]
pub struct ZkmlHeaderInfo {
    /// Base64-encoded proof
    pub proof: Option<String>,
    /// Hex-encoded model commitment
    pub model_commitment: Option<String>,
    /// USD threshold
    pub threshold: Option<u64>,
    /// Proof timestamp
    pub timestamp: Option<u64>,
    /// Proof version
    pub version: Option<u32>,
}

impl ZkmlHeaderInfo {
    /// Check if all required zkML headers are present
    pub fn is_complete(&self) -> bool {
        self.proof.is_some()
            && self.model_commitment.is_some()
            && self.timestamp.is_some()
    }

    /// Check if zkML proof is present
    pub fn has_proof(&self) -> bool {
        self.proof.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zkml_jolt::{DecisionType, InputCommitment, ModelCommitment, OutputCommitment, PROOF_VERSION};

    fn create_test_proof() -> JoltAtlasProof {
        let model_commitment = ModelCommitment::new(
            [1u8; 32],
            [2u8; 32],
            [3u8; 32],
            "test".to_string(),
        );

        let mut execution_proof = b"JOLT-ATLAS-ZK-V1".to_vec();
        execution_proof.extend_from_slice(&[0u8; 500]);

        JoltAtlasProof {
            model_commitment,
            input_commitment: InputCommitment { hash: [4u8; 32], schema_version: 1 },
            output_commitment: OutputCommitment { hash: [5u8; 32], decision_type: DecisionType::Approve },
            execution_proof,
            timestamp: 1733600000,
            version: PROOF_VERSION,
        }
    }

    #[test]
    fn test_set_and_get_proof() {
        let mut headers = HeaderMap::new();
        let proof = create_test_proof();

        headers.set_zkml_proof(&proof).unwrap();

        assert!(headers.has_zkml_proof());
        assert!(headers.get_zkml_model_commitment().is_some());
        assert!(headers.get_zkml_timestamp().is_some());
    }

    #[test]
    fn test_roundtrip() {
        let mut headers = HeaderMap::new();
        let original = create_test_proof();

        headers.set_zkml_proof(&original).unwrap();

        let decoded = headers.get_zkml_proof().unwrap().unwrap();

        assert_eq!(original.model_commitment.commitment, decoded.model_commitment.commitment);
        assert_eq!(original.timestamp, decoded.timestamp);
        assert_eq!(original.version, decoded.version);
    }

    #[test]
    fn test_threshold() {
        let mut headers = HeaderMap::new();
        let proof = create_test_proof();

        headers.set_zkml_proof_with_threshold(&proof, 5000).unwrap();

        assert_eq!(headers.get_zkml_threshold(), Some(5000));
    }
}
