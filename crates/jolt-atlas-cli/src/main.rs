//! JOLT-Atlas CLI for Visa TAP integration
//!
//! Provides command-line tools for:
//! - Generating model commitments
//! - Creating zkML proofs
//! - Verifying proofs
//! - Registering models with Visa

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;
use zkml_jolt::{CommitmentGenerator, JoltAtlas, JoltAtlasVerifier, ProofConfig, VerifierConfig};

#[derive(Parser)]
#[command(name = "jolt-atlas")]
#[command(author = "ICME Labs <dev@icme.io>")]
#[command(version = "0.1.0")]
#[command(about = "JOLT-Atlas zkML CLI for Visa TAP integration", long_about = None)]
struct Cli {
    /// Enable verbose output
    #[arg(short, long, global = true)]
    verbose: bool,

    /// Output format (json, text)
    #[arg(short, long, global = true, default_value = "text")]
    format: OutputFormat,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum OutputFormat {
    Json,
    Text,
}

impl std::str::FromStr for OutputFormat {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "json" => Ok(OutputFormat::Json),
            "text" => Ok(OutputFormat::Text),
            _ => Err(format!("Unknown format: {}", s)),
        }
    }
}

#[derive(Subcommand)]
enum Commands {
    /// Generate model commitment
    Commit {
        /// Path to model file (ONNX, TensorFlow, PyTorch)
        #[arg(short, long)]
        model: PathBuf,

        /// Output file for commitment JSON
        #[arg(short, long)]
        output: PathBuf,

        /// Model version string
        #[arg(long, default_value = "1.0.0")]
        version: String,
    },

    /// Generate zkML proof for inference
    Prove {
        /// Path to model file
        #[arg(short, long)]
        model: PathBuf,

        /// Path to input data file (JSON)
        #[arg(short, long)]
        input: PathBuf,

        /// Path to commitment file (optional, will generate if not provided)
        #[arg(short, long)]
        commitment: Option<PathBuf>,

        /// Output file for proof
        #[arg(short, long)]
        output: PathBuf,

        /// Enable zero-knowledge mode
        #[arg(long, default_value = "true")]
        zk: bool,

        /// Transaction threshold (USD)
        #[arg(long, default_value = "1000")]
        threshold: u64,
    },

    /// Verify zkML proof
    Verify {
        /// Path to proof file
        #[arg(short, long)]
        proof: PathBuf,

        /// Expected model commitment (hex)
        #[arg(short, long)]
        commitment: Option<String>,

        /// Visa registry URL for model lookup
        #[arg(long)]
        registry: Option<String>,

        /// Skip registry check
        #[arg(long)]
        skip_registry: bool,
    },

    /// Register model with Visa registry (placeholder)
    Register {
        /// Path to commitment file
        #[arg(short, long)]
        commitment: PathBuf,

        /// Visa API key
        #[arg(long, env = "VISA_API_KEY")]
        api_key: String,

        /// Agent identifier
        #[arg(long)]
        agent_id: String,

        /// Model name/description
        #[arg(long)]
        name: Option<String>,
    },

    /// Show proof information
    Info {
        /// Path to proof file
        #[arg(short, long)]
        proof: PathBuf,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Set up logging
    let level = if cli.verbose { Level::DEBUG } else { Level::INFO };
    let subscriber = FmtSubscriber::builder()
        .with_max_level(level)
        .with_target(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    match cli.command {
        Commands::Commit { model, output, version } => {
            cmd_commit(&model, &output, &version, cli.format)
        }
        Commands::Prove {
            model,
            input,
            commitment,
            output,
            zk,
            threshold,
        } => cmd_prove(&model, &input, commitment.as_deref(), &output, zk, threshold, cli.format),
        Commands::Verify {
            proof,
            commitment,
            registry,
            skip_registry,
        } => cmd_verify(&proof, commitment.as_deref(), registry.as_deref(), skip_registry, cli.format).await,
        Commands::Register {
            commitment,
            api_key,
            agent_id,
            name,
        } => cmd_register(&commitment, &api_key, &agent_id, name.as_deref(), cli.format).await,
        Commands::Info { proof } => cmd_info(&proof, cli.format),
    }
}

fn cmd_commit(model: &PathBuf, output: &PathBuf, version: &str, format: OutputFormat) -> Result<()> {
    info!("Generating commitment for {:?}", model);

    // Detect format and generate commitment
    let extension = model.extension().and_then(|e| e.to_str()).unwrap_or("");

    let mut commitment = match extension.to_lowercase().as_str() {
        "onnx" => CommitmentGenerator::from_onnx(model)?,
        "pb" => CommitmentGenerator::from_tensorflow(model)?,
        "pt" | "pth" => CommitmentGenerator::from_pytorch(model)?,
        _ => anyhow::bail!("Unsupported model format: {}", extension),
    };

    // Override version if specified
    if version != "1.0.0" {
        commitment.version = version.to_string();
    }

    // Write output
    let json = serde_json::to_string_pretty(&commitment)?;
    std::fs::write(output, &json).context("Failed to write commitment file")?;

    if format == OutputFormat::Json {
        println!("{}", json);
    } else {
        println!("Commitment generated successfully!");
        println!("  Model:        {:?}", model);
        println!("  Commitment:   {}", commitment.commitment_hex());
        println!("  Weights hash: {}", commitment.weights_hash_hex());
        println!("  Arch hash:    {}", commitment.architecture_hash_hex());
        println!("  Version:      {}", commitment.version);
        println!("  Output:       {:?}", output);
    }

    Ok(())
}

fn cmd_prove(
    model: &PathBuf,
    input: &PathBuf,
    commitment: Option<&PathBuf>,
    output: &PathBuf,
    zk: bool,
    threshold: u64,
    format: OutputFormat,
) -> Result<()> {
    info!("Generating proof for {:?}", model);

    // Create prover
    let prover = if let Some(commitment_path) = commitment {
        let commitment_json = std::fs::read_to_string(commitment_path)?;
        let commitment = serde_json::from_str(&commitment_json)?;
        JoltAtlas::with_commitment(model, commitment)?
    } else {
        JoltAtlas::new(model)?
    };

    // Read input
    let input_bytes = std::fs::read(input)?;

    // Configure proof
    let config = ProofConfig {
        zero_knowledge: zk,
        threshold: Some(threshold),
        ..Default::default()
    };

    // Generate proof
    let start = std::time::Instant::now();
    let proof = prover.prove(&input_bytes, &config)?;
    let elapsed = start.elapsed();

    // Write output
    let json = serde_json::to_string_pretty(&proof)?;
    std::fs::write(output, &json).context("Failed to write proof file")?;

    if format == OutputFormat::Json {
        println!("{}", json);
    } else {
        println!("Proof generated successfully!");
        println!("  Model commitment: {}", proof.model_commitment.commitment_hex());
        println!("  Input hash:       {}", proof.input_commitment.hash_hex());
        println!("  Output hash:      {}", proof.output_commitment.hash_hex());
        println!("  Decision:         {:?}", proof.output_commitment.decision_type);
        println!("  Zero-knowledge:   {}", zk);
        println!("  Proof size:       {} bytes", proof.execution_proof.len());
        println!("  Generation time:  {:?}", elapsed);
        println!("  Output:           {:?}", output);
    }

    Ok(())
}

async fn cmd_verify(
    proof_path: &PathBuf,
    commitment: Option<&str>,
    registry: Option<&str>,
    skip_registry: bool,
    format: OutputFormat,
) -> Result<()> {
    info!("Verifying proof {:?}", proof_path);

    // Read proof
    let proof_json = std::fs::read_to_string(proof_path)?;
    let proof: zkml_jolt::JoltAtlasProof = serde_json::from_str(&proof_json)?;

    // Check commitment if provided
    if let Some(expected) = commitment {
        let expected_bytes = hex::decode(expected)?;
        if expected_bytes.len() != 32 {
            anyhow::bail!("Commitment must be 32 bytes (64 hex chars)");
        }

        let mut expected_arr = [0u8; 32];
        expected_arr.copy_from_slice(&expected_bytes);

        if proof.model_commitment.commitment != expected_arr {
            anyhow::bail!(
                "Commitment mismatch: expected {}, got {}",
                expected,
                proof.model_commitment.commitment_hex()
            );
        }
    }

    // Create verifier
    let config = VerifierConfig {
        require_registered_model: !skip_registry,
        registry_url: registry.map(|s| s.to_string()),
        ..Default::default()
    };

    let verifier = JoltAtlasVerifier::new(config);

    // Load registry if needed
    if let Some(registry_url) = registry {
        verifier.load_registry(registry_url).await?;
    }

    // If skipping registry, add the model as registered
    if skip_registry {
        verifier.add_registered_model(zkml_jolt::RegisteredModel {
            commitment: proof.model_commitment.commitment,
            agent_id: "cli-verify".to_string(),
            registered_at: zkml_jolt::types::current_timestamp(),
            version: proof.model_commitment.version.clone(),
            name: None,
            active: true,
        });
    }

    // Verify
    let result = verifier.verify(&proof);

    if format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        if result.valid {
            println!("Proof VALID!");
            println!("  Model commitment: {}", hex::encode(&result.model_commitment));
            println!("  Verified at:      {}", result.verified_at);
        } else {
            println!("Proof INVALID!");
            println!("  Error: {}", result.error.unwrap_or_else(|| "Unknown".to_string()));
        }
    }

    if !result.valid {
        std::process::exit(1);
    }

    Ok(())
}

async fn cmd_register(
    commitment_path: &PathBuf,
    api_key: &str,
    agent_id: &str,
    name: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    info!("Registering model with Visa");

    // Read commitment
    let commitment_json = std::fs::read_to_string(commitment_path)?;
    let commitment: zkml_jolt::ModelCommitment = serde_json::from_str(&commitment_json)?;

    // In production, this would make an API call to Visa's registry
    // For now, we simulate the registration

    let registration = serde_json::json!({
        "status": "registered",
        "commitment": commitment.commitment_hex(),
        "agent_id": agent_id,
        "name": name,
        "registered_at": zkml_jolt::types::current_timestamp(),
        "api_key_used": api_key.chars().take(8).collect::<String>() + "..."
    });

    if format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&registration)?);
    } else {
        println!("Model registration simulated (not connected to real Visa API)");
        println!("  Commitment: {}", commitment.commitment_hex());
        println!("  Agent ID:   {}", agent_id);
        if let Some(n) = name {
            println!("  Name:       {}", n);
        }
        println!("\nNote: In production, this would register with Visa's Intelligent Commerce API.");
    }

    Ok(())
}

fn cmd_info(proof_path: &PathBuf, format: OutputFormat) -> Result<()> {
    // Read proof
    let proof_json = std::fs::read_to_string(proof_path)?;
    let proof: zkml_jolt::JoltAtlasProof = serde_json::from_str(&proof_json)?;

    if format == OutputFormat::Json {
        println!("{}", proof_json);
    } else {
        println!("Proof Information");
        println!("=================");
        println!();
        println!("Model Commitment:");
        println!("  Commitment:   {}", proof.model_commitment.commitment_hex());
        println!("  Weights hash: {}", proof.model_commitment.weights_hash_hex());
        println!("  Arch hash:    {}", proof.model_commitment.architecture_hash_hex());
        println!("  Version:      {}", proof.model_commitment.version);
        println!();
        println!("Input Commitment:");
        println!("  Hash:           {}", proof.input_commitment.hash_hex());
        println!("  Schema version: {}", proof.input_commitment.schema_version);
        println!();
        println!("Output Commitment:");
        println!("  Hash:     {}", proof.output_commitment.hash_hex());
        println!("  Decision: {:?}", proof.output_commitment.decision_type);
        println!();
        println!("Proof Details:");
        println!("  Timestamp: {}", proof.timestamp);
        println!("  Version:   {}", proof.version);
        println!("  Size:      {} bytes", proof.execution_proof.len());

        // Check freshness
        let now = zkml_jolt::types::current_timestamp();
        let age = now.saturating_sub(proof.timestamp);
        println!("  Age:       {}s", age);

        if proof.is_fresh(300) {
            println!("  Status:    Fresh (< 5 minutes)");
        } else {
            println!("  Status:    Stale (> 5 minutes)");
        }
    }

    Ok(())
}
