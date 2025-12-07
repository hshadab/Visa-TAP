//! Error types for zkml-jolt

use thiserror::Error;

/// Result type alias for zkml-jolt operations
pub type Result<T> = std::result::Result<T, Error>;

/// Errors that can occur in zkml-jolt operations
#[derive(Error, Debug)]
pub enum Error {
    /// Model file not found or unreadable
    #[error("Model error: {0}")]
    Model(String),

    /// Model format not supported
    #[error("Unsupported model format: {0}")]
    UnsupportedFormat(String),

    /// Commitment mismatch between expected and computed
    #[error("Commitment mismatch: expected {expected}, got {actual}")]
    CommitmentMismatch { expected: String, actual: String },

    /// Proof generation failed
    #[error("Proof generation failed: {0}")]
    ProofGeneration(String),

    /// Proof verification failed
    #[error("Proof verification failed: {0}")]
    ProofVerification(String),

    /// Proof expired (timestamp too old)
    #[error("Proof expired: timestamp {timestamp} is older than max age {max_age}s")]
    ProofExpired { timestamp: u64, max_age: u64 },

    /// Model not found in registry
    #[error("Model not found in registry: {0}")]
    ModelNotRegistered(String),

    /// Serialization/deserialization error
    #[error("Serialization error: {0}")]
    Serialization(String),

    /// I/O error
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    /// HTTP request error
    #[error("HTTP error: {0}")]
    Http(String),

    /// Configuration error
    #[error("Configuration error: {0}")]
    Config(String),

    /// Invalid input data
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl Error {
    /// Get error code for API responses
    pub fn error_code(&self) -> &'static str {
        match self {
            Error::Model(_) => "MODEL_ERROR",
            Error::UnsupportedFormat(_) => "UNSUPPORTED_FORMAT",
            Error::CommitmentMismatch { .. } => "COMMITMENT_MISMATCH",
            Error::ProofGeneration(_) => "PROOF_GENERATION_FAILED",
            Error::ProofVerification(_) => "PROOF_VERIFICATION_FAILED",
            Error::ProofExpired { .. } => "PROOF_EXPIRED",
            Error::ModelNotRegistered(_) => "MODEL_NOT_REGISTERED",
            Error::Serialization(_) => "SERIALIZATION_ERROR",
            Error::Io(_) => "IO_ERROR",
            Error::Http(_) => "HTTP_ERROR",
            Error::Config(_) => "CONFIG_ERROR",
            Error::InvalidInput(_) => "INVALID_INPUT",
            Error::Internal(_) => "INTERNAL_ERROR",
        }
    }
}
