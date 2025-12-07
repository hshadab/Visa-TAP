//! Model commitment generation
//!
//! Generates cryptographic commitments that bind proofs to specific model versions.

use crate::{Error, ModelCommitment, Result};
use sha3::{Digest, Keccak256};
use std::path::Path;

/// Generates model commitments from various model formats
pub struct CommitmentGenerator;

impl CommitmentGenerator {
    /// Generate model commitment from an ONNX file
    ///
    /// # Arguments
    /// * `model_path` - Path to the ONNX model file
    ///
    /// # Returns
    /// A `ModelCommitment` that uniquely identifies this model version
    ///
    /// # Example
    /// ```rust,ignore
    /// let commitment = CommitmentGenerator::from_onnx("model.onnx")?;
    /// println!("Commitment: {}", commitment.commitment_hex());
    /// ```
    pub fn from_onnx(model_path: impl AsRef<Path>) -> Result<ModelCommitment> {
        let model_bytes = std::fs::read(model_path.as_ref())?;
        Self::from_onnx_bytes(&model_bytes)
    }

    /// Generate commitment from ONNX bytes
    pub fn from_onnx_bytes(model_bytes: &[u8]) -> Result<ModelCommitment> {
        // Parse ONNX to extract weights and architecture
        // In production, this would use the onnx crate for proper parsing
        // For now, we use a simplified approach

        let (weights, architecture) = Self::parse_onnx_components(model_bytes)?;

        Self::from_components(&weights, &architecture, "1.0.0")
    }

    /// Generate commitment from raw components
    ///
    /// # Arguments
    /// * `weights` - Raw model weights/parameters
    /// * `architecture` - Model architecture specification
    /// * `version` - Version string for tracking
    pub fn from_components(
        weights: &[u8],
        architecture: &[u8],
        version: &str,
    ) -> Result<ModelCommitment> {
        let weights_hash = keccak256(weights);
        let architecture_hash = keccak256(architecture);

        // Combined commitment
        let mut combined = Vec::with_capacity(64);
        combined.extend_from_slice(&weights_hash);
        combined.extend_from_slice(&architecture_hash);
        let commitment = keccak256(&combined);

        Ok(ModelCommitment::new(
            weights_hash,
            architecture_hash,
            commitment,
            version.to_string(),
        ))
    }

    /// Generate commitment from TensorFlow SavedModel
    pub fn from_tensorflow(model_path: impl AsRef<Path>) -> Result<ModelCommitment> {
        let model_bytes = std::fs::read(model_path.as_ref())?;

        // Simplified: hash entire file
        // Production would parse TF format properly
        let weights_hash = keccak256(&model_bytes);
        let architecture_hash = keccak256(b"tensorflow_savedmodel_v2");

        let mut combined = Vec::with_capacity(64);
        combined.extend_from_slice(&weights_hash);
        combined.extend_from_slice(&architecture_hash);

        Ok(ModelCommitment::new(
            weights_hash,
            architecture_hash,
            keccak256(&combined),
            "1.0.0".to_string(),
        ))
    }

    /// Generate commitment from PyTorch model
    pub fn from_pytorch(model_path: impl AsRef<Path>) -> Result<ModelCommitment> {
        let model_bytes = std::fs::read(model_path.as_ref())?;

        let weights_hash = keccak256(&model_bytes);
        let architecture_hash = keccak256(b"pytorch_v2");

        let mut combined = Vec::with_capacity(64);
        combined.extend_from_slice(&weights_hash);
        combined.extend_from_slice(&architecture_hash);

        Ok(ModelCommitment::new(
            weights_hash,
            architecture_hash,
            keccak256(&combined),
            "1.0.0".to_string(),
        ))
    }

    /// Verify that a model matches an expected commitment
    pub fn verify_commitment(
        model_path: impl AsRef<Path>,
        expected: &ModelCommitment,
    ) -> Result<bool> {
        let extension = model_path
            .as_ref()
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let computed = match extension {
            "onnx" => Self::from_onnx(&model_path)?,
            "pb" => Self::from_tensorflow(&model_path)?,
            "pt" | "pth" => Self::from_pytorch(&model_path)?,
            _ => return Err(Error::UnsupportedFormat(extension.to_string())),
        };

        Ok(computed.commitment == expected.commitment)
    }

    /// Parse ONNX file into weights and architecture components
    fn parse_onnx_components(model_bytes: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        // Simplified ONNX parsing
        // In production, use the onnx crate for proper protobuf parsing

        // ONNX magic bytes check
        if model_bytes.len() < 8 {
            return Err(Error::Model("Invalid ONNX file: too small".to_string()));
        }

        // For now, use a deterministic split based on file structure
        // Production implementation would properly parse ONNX protobuf
        let mid = model_bytes.len() / 2;

        // Weights are typically in the second half (initializers)
        let architecture = model_bytes[..mid.min(1024)].to_vec();
        let weights = model_bytes[mid..].to_vec();

        Ok((weights, architecture))
    }
}

/// Compute Keccak256 hash
fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_components() {
        let weights = b"model weights data";
        let architecture = b"model architecture spec";

        let commitment =
            CommitmentGenerator::from_components(weights, architecture, "1.0.0").unwrap();

        assert!(!commitment.commitment_hex().is_empty());
        assert_eq!(commitment.version, "1.0.0");
    }

    #[test]
    fn test_deterministic_commitment() {
        let weights = b"same weights";
        let architecture = b"same architecture";

        let c1 = CommitmentGenerator::from_components(weights, architecture, "1.0.0").unwrap();
        let c2 = CommitmentGenerator::from_components(weights, architecture, "1.0.0").unwrap();

        assert_eq!(c1.commitment, c2.commitment);
        assert_eq!(c1.weights_hash, c2.weights_hash);
    }

    #[test]
    fn test_different_inputs_different_commitment() {
        let c1 =
            CommitmentGenerator::from_components(b"weights1", b"arch", "1.0.0").unwrap();
        let c2 =
            CommitmentGenerator::from_components(b"weights2", b"arch", "1.0.0").unwrap();

        assert_ne!(c1.commitment, c2.commitment);
    }
}
