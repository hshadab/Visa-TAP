//! # zkml-jolt
//!
//! JOLT-Atlas zkML proof generation and verification library for
//! Visa Trusted Agent Protocol (TAP) integration.
//!
//! This crate provides:
//! - Model commitment generation
//! - Zero-knowledge proof generation for ML inference
//! - Proof verification
//! - TAP-compatible serialization
//!
//! ## Quick Start
//!
//! ```rust,ignore
//! use zkml_jolt::{JoltAtlas, ProofConfig, CommitmentGenerator};
//!
//! // Generate model commitment
//! let commitment = CommitmentGenerator::from_onnx("model.onnx")?;
//!
//! // Create prover
//! let prover = JoltAtlas::with_commitment("model.onnx", commitment)?;
//!
//! // Generate proof
//! let proof = prover.prove(input_data, &ProofConfig::default())?;
//! ```

pub mod commitment;
pub mod config;
pub mod error;
pub mod prover;
pub mod types;
pub mod verifier;

// Re-exports
pub use commitment::CommitmentGenerator;
pub use config::{ProofConfig, ProvingParams, VerifierConfig};
pub use error::{Error, Result};
pub use prover::JoltAtlas;
pub use types::*;
pub use verifier::JoltAtlasVerifier;

/// Current proof format version
pub const PROOF_VERSION: u32 = 1;

/// Default transaction threshold (USD) for requiring zkML proof
pub const DEFAULT_THRESHOLD: u64 = 1000;

/// Maximum proof age (seconds) for freshness validation
pub const DEFAULT_MAX_PROOF_AGE: u64 = 300;
