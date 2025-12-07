//! Example: Integrating zkML proofs into an AI agent
//!
//! This example demonstrates how an AI agent can generate zkML proofs
//! for high-value transactions and include them in TAP requests.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use zkml_jolt::{CommitmentGenerator, JoltAtlas, ProofConfig};
use zkml_tap::ZkmlHeaders;

/// Transaction request from user
#[derive(Debug, Serialize, Deserialize)]
struct TransactionRequest {
    /// Transaction amount in USD
    amount: u64,
    /// Merchant identifier
    merchant_id: String,
    /// User's intent description
    user_intent: String,
}

/// USD threshold for requiring zkML proof
const ZKML_THRESHOLD: u64 = 1000;

#[tokio::main]
async fn main() -> Result<()> {
    println!("=== AI Agent zkML Integration Example ===\n");

    // Step 1: Generate model commitment (done once during certification)
    println!("Step 1: Generating model commitment...");
    let commitment = create_test_commitment()?;
    println!("  Commitment: {}", commitment.commitment_hex());
    println!("  Version: {}\n", commitment.version);

    // Step 2: Initialize prover with commitment
    println!("Step 2: Initializing prover...");
    let model_bytes = create_test_model();
    let prover = zkml_jolt::prover::JoltAtlas::from_bytes(
        model_bytes,
        zkml_jolt::prover::ModelFormat::Onnx,
    )?;
    println!("  Prover initialized with model\n");

    // Step 3: Process a transaction
    let transaction = TransactionRequest {
        amount: 5000, // $5000 - above threshold
        merchant_id: "merchant-456".to_string(),
        user_intent: "Purchase laptop as authorized".to_string(),
    };

    println!("Step 3: Processing transaction...");
    println!("  Amount: ${}", transaction.amount);
    println!("  Merchant: {}", transaction.merchant_id);
    println!("  Intent: {}", transaction.user_intent);

    // Step 4: Check if zkML proof is required
    let proof_required = transaction.amount >= ZKML_THRESHOLD;
    println!("\nStep 4: zkML proof required? {}", proof_required);

    // Step 5: Generate proof if required
    if proof_required {
        println!("\nStep 5: Generating zkML proof...");

        let input = serde_json::to_vec(&transaction)?;
        let config = ProofConfig {
            zero_knowledge: true,
            threshold: Some(ZKML_THRESHOLD),
            ..Default::default()
        };

        let start = std::time::Instant::now();
        let proof = prover.prove(&input, &config)?;
        let elapsed = start.elapsed();

        println!("  Proof generated in {:?}", elapsed);
        println!("  Model commitment: {}", proof.model_commitment.commitment_hex());
        println!("  Input hash: {}", proof.input_commitment.hash_hex());
        println!("  Decision: {:?}", proof.output_commitment.decision_type);
        println!("  Proof size: {} bytes", proof.execution_proof.len());

        // Step 6: Create TAP headers with zkML proof
        println!("\nStep 6: Creating TAP headers...");
        let mut headers = http::HeaderMap::new();
        headers.set_zkml_proof(&proof)?;

        println!("  Headers set:");
        for (name, value) in headers.iter() {
            let display_value = if name.as_str() == "x-zkml-proof" {
                format!("{}... ({} chars)", &value.to_str()?[..50], value.len())
            } else {
                value.to_str()?.to_string()
            };
            println!("    {}: {}", name, display_value);
        }
    }

    println!("\n=== Example Complete ===");
    println!("\nIn a real implementation:");
    println!("  1. Model would be loaded from a trained ONNX file");
    println!("  2. Commitment would be registered with Visa during certification");
    println!("  3. Proof would be sent with the actual TAP payment request");
    println!("  4. Merchant would verify proof before processing payment");

    Ok(())
}

/// Create a test model commitment
fn create_test_commitment() -> Result<zkml_jolt::ModelCommitment> {
    let weights = b"test model weights for demonstration";
    let architecture = b"test model architecture";
    Ok(CommitmentGenerator::from_components(weights, architecture, "1.0.0")?)
}

/// Create test model bytes
fn create_test_model() -> Vec<u8> {
    // In production, this would be an actual ONNX model file
    b"FAKE ONNX MODEL DATA FOR DEMONSTRATION PURPOSES".to_vec()
}
