//! # zkml-tap
//!
//! TAP (Trusted Agent Protocol) integration layer for JOLT-Atlas zkML proofs.
//!
//! This crate provides:
//! - HTTP header extensions for zkML proofs
//! - Payment container extensions
//! - Middleware for verification
//!
//! ## Example
//!
//! ```rust,ignore
//! use zkml_tap::{ZkmlHeaders, ZkmlPaymentContainer};
//! use zkml_jolt::JoltAtlasProof;
//!
//! // Add zkML proof to HTTP headers
//! let mut headers = http::HeaderMap::new();
//! headers.set_zkml_proof(&proof)?;
//! ```

pub mod container;
pub mod headers;
pub mod middleware;

// Re-exports
pub use container::ZkmlPaymentContainer;
pub use headers::{ZkmlHeaders, HEADER_MODEL_COMMITMENT, HEADER_PROOF, HEADER_THRESHOLD, HEADER_TIMESTAMP, HEADER_VERSION};
pub use middleware::ZkmlMiddleware;

/// Default transaction threshold (USD) for requiring zkML proof
pub const DEFAULT_THRESHOLD: u64 = 1000;
