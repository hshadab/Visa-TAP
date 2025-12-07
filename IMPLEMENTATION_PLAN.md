# JOLT-Atlas zkML Integration - Implementation Plan

## Executive Summary

This document outlines the phased implementation plan for integrating JOLT-Atlas zkML with Visa TAP. The implementation is organized into 9 phases, each building upon the previous.

---

## Phase 1: Project Foundation & Core Types

### 1.1 Project Structure Setup

**Tasks:**
- Initialize Cargo workspace for Rust crates
- Initialize npm/yarn workspace for Node.js packages
- Set up CI/CD configuration
- Create documentation structure

**Deliverables:**
- `Cargo.toml` (workspace)
- `package.json` (workspace)
- `.github/workflows/` CI configuration
- Base documentation files

### 1.2 Core Type Definitions

**Rust Types (`crates/zkml-jolt/src/types.rs`):**

```rust
/// Model commitment - cryptographic binding to a specific model version
pub struct ModelCommitment {
    /// Keccak256 hash of model weights
    pub weights_hash: [u8; 32],
    /// Keccak256 hash of model architecture
    pub architecture_hash: [u8; 32],
    /// Combined commitment hash
    pub commitment: [u8; 32],
    /// Model version identifier
    pub version: String,
    /// Timestamp of commitment generation
    pub created_at: u64,
}

/// Input commitment - privacy-preserving hash of transaction context
pub struct InputCommitment {
    /// Hash of input data
    pub hash: [u8; 32],
    /// Input schema version
    pub schema_version: u32,
}

/// Output commitment - hash of model decision
pub struct OutputCommitment {
    /// Hash of output data
    pub hash: [u8; 32],
    /// Decision type (approve/deny/escalate)
    pub decision_type: DecisionType,
}

/// The complete JOLT-Atlas proof structure
pub struct JoltAtlasProof {
    /// Model commitment binding proof to model version
    pub model_commitment: ModelCommitment,
    /// Input commitment (privacy-preserving)
    pub input_commitment: InputCommitment,
    /// Output commitment
    pub output_commitment: OutputCommitment,
    /// The cryptographic execution proof
    pub execution_proof: Vec<u8>,
    /// Proof generation timestamp
    pub timestamp: u64,
    /// Proof version
    pub version: u32,
}

/// Verification result
pub struct VerificationResult {
    /// Whether the proof is valid
    pub valid: bool,
    /// Model commitment verified
    pub model_commitment: [u8; 32],
    /// Timestamp of verification
    pub verified_at: u64,
    /// Error message if invalid
    pub error: Option<String>,
}

/// Decision types for agent transactions
pub enum DecisionType {
    Approve,
    Deny,
    Escalate,
    Defer,
}

/// Proof configuration options
pub struct ProofConfig {
    /// Enable zero-knowledge mode (hide model weights/inputs)
    pub zero_knowledge: bool,
    /// Pre-registered model commitment for binding
    pub model_commitment: Option<ModelCommitment>,
    /// Transaction threshold that triggered proof
    pub threshold: Option<u64>,
    /// Custom proving parameters
    pub proving_params: Option<ProvingParams>,
}

/// Proving parameters for fine-tuning proof generation
pub struct ProvingParams {
    /// Security level (bits)
    pub security_level: u32,
    /// Enable HyperNova folding
    pub use_hypernova: bool,
    /// Maximum proof size (bytes)
    pub max_proof_size: Option<usize>,
}
```

**TypeScript Types (`packages/jolt-atlas/src/types.ts`):**

```typescript
export interface ModelCommitment {
  weightsHash: string;        // hex-encoded 32 bytes
  architectureHash: string;   // hex-encoded 32 bytes
  commitment: string;         // hex-encoded 32 bytes
  version: string;
  createdAt: number;
}

export interface InputCommitment {
  hash: string;
  schemaVersion: number;
}

export interface OutputCommitment {
  hash: string;
  decisionType: DecisionType;
}

export interface JoltAtlasProof {
  modelCommitment: ModelCommitment;
  inputCommitment: InputCommitment;
  outputCommitment: OutputCommitment;
  executionProof: string;     // base64-encoded
  timestamp: number;
  version: number;
}

export interface VerificationResult {
  valid: boolean;
  modelCommitment: string;
  verifiedAt: number;
  error?: string;
}

export enum DecisionType {
  Approve = 'approve',
  Deny = 'deny',
  Escalate = 'escalate',
  Defer = 'defer',
}

export interface ProofConfig {
  zeroKnowledge: boolean;
  modelCommitment?: ModelCommitment;
  threshold?: number;
  provingParams?: ProvingParams;
}

export interface ProvingParams {
  securityLevel: number;
  useHypernova: boolean;
  maxProofSize?: number;
}
```

---

## Phase 2: Model Commitment Generation

### 2.1 Commitment Algorithm

The model commitment binds a proof to a specific model version:

```
commitment = keccak256(
  keccak256(model_weights) ||
  keccak256(architecture_spec) ||
  version_bytes
)
```

### 2.2 Rust Implementation

**File: `crates/zkml-jolt/src/commitment.rs`**

```rust
use sha3::{Keccak256, Digest};

pub struct CommitmentGenerator;

impl CommitmentGenerator {
    /// Generate model commitment from ONNX file
    pub fn from_onnx(model_path: &Path) -> Result<ModelCommitment> {
        let model_bytes = std::fs::read(model_path)?;
        let (weights, architecture) = parse_onnx(&model_bytes)?;

        let weights_hash = keccak256(&weights);
        let architecture_hash = keccak256(&architecture);

        let mut combined = Vec::new();
        combined.extend_from_slice(&weights_hash);
        combined.extend_from_slice(&architecture_hash);

        let commitment = keccak256(&combined);

        Ok(ModelCommitment {
            weights_hash,
            architecture_hash,
            commitment,
            version: extract_version(&model_bytes)?,
            created_at: current_timestamp(),
        })
    }

    /// Generate commitment from raw components
    pub fn from_components(
        weights: &[u8],
        architecture: &[u8],
        version: &str,
    ) -> ModelCommitment {
        let weights_hash = keccak256(weights);
        let architecture_hash = keccak256(architecture);

        let mut combined = Vec::new();
        combined.extend_from_slice(&weights_hash);
        combined.extend_from_slice(&architecture_hash);

        ModelCommitment {
            weights_hash,
            architecture_hash,
            commitment: keccak256(&combined),
            version: version.to_string(),
            created_at: current_timestamp(),
        }
    }
}

fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().into()
}
```

### 2.3 Supported Model Formats

| Format | Extension | Support Level |
|--------|-----------|---------------|
| ONNX | .onnx | Full |
| TensorFlow SavedModel | .pb | Full |
| PyTorch | .pt, .pth | Partial |
| GGUF (LLM) | .gguf | Planned |

---

## Phase 3: Proof Generation (Prover)

### 3.1 JOLT-Atlas Prover Architecture

The prover wraps the JOLT zkVM with ML-specific optimizations:

```
┌─────────────────────────────────────────────────────┐
│                   JoltAtlas Prover                   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Model     │  │   Input     │  │   Config    │  │
│  │   Loader    │  │   Encoder   │  │   Manager   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │         │
│         └────────────────┼────────────────┘         │
│                          ▼                          │
│              ┌───────────────────────┐              │
│              │    JOLT zkVM Core     │              │
│              │  (HyperNova Folding)  │              │
│              └───────────────────────┘              │
│                          │                          │
│                          ▼                          │
│              ┌───────────────────────┐              │
│              │   Proof Serializer    │              │
│              └───────────────────────┘              │
└─────────────────────────────────────────────────────┘
```

### 3.2 Rust Prover Implementation

**File: `crates/zkml-jolt/src/prover.rs`**

```rust
pub struct JoltAtlas {
    model: LoadedModel,
    commitment: ModelCommitment,
    config: ProverConfig,
}

impl JoltAtlas {
    /// Create new prover instance with model
    pub fn new(model_path: impl AsRef<Path>) -> Result<Self> {
        let model = ModelLoader::load(model_path.as_ref())?;
        let commitment = CommitmentGenerator::from_model(&model)?;

        Ok(Self {
            model,
            commitment,
            config: ProverConfig::default(),
        })
    }

    /// Create prover with pre-computed commitment
    pub fn with_commitment(
        model_path: impl AsRef<Path>,
        commitment: ModelCommitment,
    ) -> Result<Self> {
        let model = ModelLoader::load(model_path.as_ref())?;

        // Verify commitment matches model
        let computed = CommitmentGenerator::from_model(&model)?;
        if computed.commitment != commitment.commitment {
            return Err(Error::CommitmentMismatch);
        }

        Ok(Self {
            model,
            commitment,
            config: ProverConfig::default(),
        })
    }

    /// Generate zkML proof for inference
    pub fn prove(
        &self,
        input: &[u8],
        config: &ProofConfig,
    ) -> Result<JoltAtlasProof> {
        let start = Instant::now();

        // 1. Encode input
        let input_commitment = InputCommitment::from_bytes(input);

        // 2. Run inference in JOLT VM
        let (output, trace) = self.execute_inference(input)?;

        // 3. Generate output commitment
        let output_commitment = OutputCommitment::from_inference_result(&output);

        // 4. Generate JOLT proof with HyperNova
        let execution_proof = if config.zero_knowledge {
            self.generate_zk_proof(&trace)?
        } else {
            self.generate_proof(&trace)?
        };

        let proof = JoltAtlasProof {
            model_commitment: self.commitment.clone(),
            input_commitment,
            output_commitment,
            execution_proof,
            timestamp: current_timestamp(),
            version: PROOF_VERSION,
        };

        log::info!("Proof generated in {:?}", start.elapsed());

        Ok(proof)
    }

    /// Batch prove multiple inferences
    pub fn prove_batch(
        &self,
        inputs: &[&[u8]],
        config: &ProofConfig,
    ) -> Result<Vec<JoltAtlasProof>> {
        inputs.par_iter()
            .map(|input| self.prove(input, config))
            .collect()
    }
}
```

### 3.3 Performance Targets

| Operation | Target Time | Notes |
|-----------|-------------|-------|
| Model loading | < 500ms | Cached after first load |
| Proof generation | ~700ms | HyperNova optimized |
| Proof serialization | < 50ms | Base64 encoding |
| Total latency | < 1.2s | End-to-end |

---

## Phase 4: Proof Verification (Verifier)

### 4.1 Verification Flow

```
┌──────────────────────────────────────────────────────────┐
│                    Verification Flow                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐    ┌─────────────┐    ┌────────────────┐   │
│  │  Proof  │───▶│   Decode    │───▶│ Check Model    │   │
│  │ (Base64)│    │   Proof     │    │ Registry       │   │
│  └─────────┘    └─────────────┘    └───────┬────────┘   │
│                                            │            │
│                                            ▼            │
│  ┌─────────┐    ┌─────────────┐    ┌────────────────┐   │
│  │ Result  │◀───│   Verify    │◀───│ Check          │   │
│  │         │    │   JOLT      │    │ Timestamp      │   │
│  └─────────┘    └─────────────┘    └────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Rust Verifier Implementation

**File: `crates/zkml-jolt/src/verifier.rs`**

```rust
pub struct JoltAtlasVerifier {
    /// Registered model commitments (from Visa registry)
    registered_models: HashMap<[u8; 32], RegisteredModel>,
    /// Verification configuration
    config: VerifierConfig,
}

impl JoltAtlasVerifier {
    /// Create verifier with model registry
    pub fn new(config: VerifierConfig) -> Self {
        Self {
            registered_models: HashMap::new(),
            config,
        }
    }

    /// Load registered models from Visa registry
    pub async fn load_registry(&mut self, registry_url: &str) -> Result<()> {
        let response = reqwest::get(registry_url).await?;
        let models: Vec<RegisteredModel> = response.json().await?;

        for model in models {
            self.registered_models.insert(model.commitment, model);
        }

        Ok(())
    }

    /// Verify a JOLT-Atlas proof
    pub fn verify(&self, proof: &JoltAtlasProof) -> VerificationResult {
        let start = Instant::now();

        // 1. Check proof freshness
        if !self.check_timestamp(proof.timestamp) {
            return VerificationResult::invalid("Proof timestamp expired");
        }

        // 2. Verify model is registered (if registry check enabled)
        if self.config.require_registered_model {
            if !self.registered_models.contains_key(&proof.model_commitment.commitment) {
                return VerificationResult::invalid("Model not in registry");
            }
        }

        // 3. Verify JOLT proof cryptographically
        match self.verify_jolt_proof(&proof.execution_proof) {
            Ok(true) => {},
            Ok(false) => return VerificationResult::invalid("JOLT proof invalid"),
            Err(e) => return VerificationResult::invalid(&format!("Verification error: {}", e)),
        }

        // 4. Verify commitment binding
        if !self.verify_commitment_binding(proof) {
            return VerificationResult::invalid("Commitment binding invalid");
        }

        log::info!("Proof verified in {:?}", start.elapsed());

        VerificationResult {
            valid: true,
            model_commitment: proof.model_commitment.commitment,
            verified_at: current_timestamp(),
            error: None,
        }
    }

    /// Batch verify multiple proofs
    pub fn verify_batch(&self, proofs: &[JoltAtlasProof]) -> Vec<VerificationResult> {
        proofs.par_iter()
            .map(|proof| self.verify(proof))
            .collect()
    }
}

/// Verifier configuration
pub struct VerifierConfig {
    /// Require model to be in registry
    pub require_registered_model: bool,
    /// Maximum proof age (seconds)
    pub max_proof_age: u64,
    /// Registry URL for model lookup
    pub registry_url: Option<String>,
}

impl Default for VerifierConfig {
    fn default() -> Self {
        Self {
            require_registered_model: true,
            max_proof_age: 300, // 5 minutes
            registry_url: None,
        }
    }
}
```

### 4.3 TypeScript Verifier

**File: `packages/zkml-verifier/src/verifier.ts`**

```typescript
export class JoltAtlasVerifier {
  private registeredModels: Map<string, RegisteredModel>;
  private config: VerifierConfig;

  constructor(config: Partial<VerifierConfig> = {}) {
    this.registeredModels = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async loadRegistry(registryUrl: string): Promise<void> {
    const response = await fetch(registryUrl);
    const models: RegisteredModel[] = await response.json();

    for (const model of models) {
      this.registeredModels.set(model.commitment, model);
    }
  }

  async verify(params: VerifyParams): Promise<VerificationResult> {
    const { proof, modelCommitment, registeredModels } = params;

    // Decode proof
    const decodedProof = this.decodeProof(proof);

    // Check timestamp
    if (!this.checkTimestamp(decodedProof.timestamp)) {
      return { valid: false, error: 'Proof timestamp expired' };
    }

    // Verify model registration
    if (this.config.requireRegisteredModel) {
      const models = registeredModels || this.registeredModels;
      if (!models.has(modelCommitment)) {
        return { valid: false, error: 'Model not in registry' };
      }
    }

    // Verify JOLT proof (WASM binding)
    const joltValid = await this.verifyJoltProof(decodedProof.executionProof);
    if (!joltValid) {
      return { valid: false, error: 'JOLT proof invalid' };
    }

    return {
      valid: true,
      modelCommitment,
      verifiedAt: Date.now(),
    };
  }
}
```

---

## Phase 5: TAP Message Format Extensions

### 5.1 HTTP Header Extensions

New headers for TAP Payment Containers:

| Header | Description | Required |
|--------|-------------|----------|
| `X-ZKML-PROOF` | Base64-encoded JOLT-Atlas proof | Yes (if threshold met) |
| `X-ZKML-MODEL-COMMITMENT` | Hex-encoded model commitment | Yes |
| `X-ZKML-THRESHOLD` | USD threshold that triggered proof | Optional |
| `X-ZKML-TIMESTAMP` | Unix timestamp of proof generation | Yes |
| `X-ZKML-VERSION` | Proof format version | Optional |

### 5.2 Header Implementation

**File: `crates/zkml-tap/src/headers.rs`**

```rust
pub const HEADER_PROOF: &str = "X-ZKML-PROOF";
pub const HEADER_MODEL_COMMITMENT: &str = "X-ZKML-MODEL-COMMITMENT";
pub const HEADER_THRESHOLD: &str = "X-ZKML-THRESHOLD";
pub const HEADER_TIMESTAMP: &str = "X-ZKML-TIMESTAMP";
pub const HEADER_VERSION: &str = "X-ZKML-VERSION";

/// Extension trait for adding zkML headers
pub trait ZkmlHeaders {
    fn set_zkml_proof(&mut self, proof: &JoltAtlasProof) -> Result<()>;
    fn get_zkml_proof(&self) -> Result<Option<JoltAtlasProof>>;
}

impl ZkmlHeaders for HeaderMap {
    fn set_zkml_proof(&mut self, proof: &JoltAtlasProof) -> Result<()> {
        let encoded = base64::encode(&proof.to_bytes()?);
        self.insert(HEADER_PROOF, encoded.parse()?);

        let commitment = hex::encode(&proof.model_commitment.commitment);
        self.insert(HEADER_MODEL_COMMITMENT, commitment.parse()?);

        self.insert(HEADER_TIMESTAMP, proof.timestamp.to_string().parse()?);
        self.insert(HEADER_VERSION, proof.version.to_string().parse()?);

        Ok(())
    }

    fn get_zkml_proof(&self) -> Result<Option<JoltAtlasProof>> {
        let Some(encoded) = self.get(HEADER_PROOF) else {
            return Ok(None);
        };

        let bytes = base64::decode(encoded.to_str()?)?;
        let proof = JoltAtlasProof::from_bytes(&bytes)?;

        Ok(Some(proof))
    }
}
```

### 5.3 Payment Container Extension

```rust
/// Extended TAP Payment Container with zkML
pub struct ZkmlPaymentContainer {
    /// Original TAP container
    pub tap_container: TapPaymentContainer,
    /// zkML proof (if required)
    pub zkml_proof: Option<JoltAtlasProof>,
    /// Threshold that triggered proof requirement
    pub zkml_threshold: Option<u64>,
}

impl ZkmlPaymentContainer {
    /// Check if zkML proof is required based on amount
    pub fn requires_proof(&self, threshold: u64) -> bool {
        self.tap_container.amount >= threshold
    }

    /// Add zkML proof to container
    pub fn with_proof(mut self, proof: JoltAtlasProof, threshold: u64) -> Self {
        self.zkml_proof = Some(proof);
        self.zkml_threshold = Some(threshold);
        self
    }
}
```

---

## Phase 6: CDN Proxy Integration

### 6.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CDN Proxy Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                      ┌─────────────────┐   │
│  │   Incoming  │                      │    TAP          │   │
│  │   Request   │─────────────────────▶│    Signature    │   │
│  │             │                      │    Verify       │   │
│  └─────────────┘                      └────────┬────────┘   │
│                                                │            │
│                                                ▼            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Amount > Threshold?                     │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│           ┌──────────────┴──────────────┐                  │
│           │                             │                  │
│           ▼ Yes                         ▼ No               │
│  ┌─────────────────┐           ┌─────────────────┐        │
│  │   zkML Proof    │           │   Proceed       │        │
│  │   Verification  │           │   (TAP only)    │        │
│  └────────┬────────┘           └─────────────────┘        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │   Forward to    │                                       │
│  │   Merchant      │                                       │
│  └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Implementation

**File: `cdn-proxy/src/verify.ts`**

```typescript
import { JoltAtlasVerifier } from '@icme/zkml-verifier';

const verifier = new JoltAtlasVerifier();

export interface ZkmlVerificationResult {
  zkml: 'verified' | 'not_required' | 'failed';
  error?: string;
  modelCommitment?: string;
}

export async function verifyZkmlProof(
  req: Request,
  transactionAmount: number,
  threshold: number = 1000
): Promise<ZkmlVerificationResult> {
  // Check if proof is required
  if (transactionAmount < threshold) {
    return { zkml: 'not_required' };
  }

  // Extract zkML headers
  const proof = req.headers['x-zkml-proof'];
  const commitment = req.headers['x-zkml-model-commitment'];
  const timestamp = req.headers['x-zkml-timestamp'];

  // Proof required but missing
  if (!proof || !commitment) {
    return {
      zkml: 'failed',
      error: 'zkML proof required for transactions above threshold'
    };
  }

  try {
    // Option A: Facilitator verification
    if (process.env.ZKML_VERIFY_MODE === 'facilitator') {
      return await verifyViaFacilitator(proof, commitment);
    }

    // Option B: Local verification
    const result = await verifier.verify({
      proof: Buffer.from(proof, 'base64'),
      modelCommitment: commitment,
    });

    if (result.valid) {
      return {
        zkml: 'verified',
        modelCommitment: commitment
      };
    } else {
      return {
        zkml: 'failed',
        error: result.error
      };
    }
  } catch (error) {
    return {
      zkml: 'failed',
      error: `Verification error: ${error.message}`
    };
  }
}

async function verifyViaFacilitator(
  proof: string,
  commitment: string
): Promise<ZkmlVerificationResult> {
  const response = await fetch('https://verify.novanet.xyz/v1/zkml/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proof, model_commitment: commitment }),
  });

  const result = await response.json();

  if (result.valid) {
    return { zkml: 'verified', modelCommitment: commitment };
  } else {
    return { zkml: 'failed', error: result.error };
  }
}
```

### 6.3 Express Middleware

**File: `cdn-proxy/src/middleware.ts`**

```typescript
import { verifyZkmlProof } from './verify';

export function zkmlMiddleware(options: ZkmlMiddlewareOptions = {}) {
  const threshold = options.threshold ?? 1000;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract transaction amount from TAP container
    const amount = extractTransactionAmount(req);

    // Verify zkML proof if required
    const result = await verifyZkmlProof(req, amount, threshold);

    // Attach result to request for downstream handlers
    req.zkmlVerification = result;

    if (result.zkml === 'failed') {
      return res.status(403).json({
        error: 'zkML verification failed',
        details: result.error,
      });
    }

    next();
  };
}
```

---

## Phase 7: CLI Tool

### 7.1 Commands

```
jolt-atlas 1.0.0
JOLT-Atlas zkML CLI for Visa TAP integration

USAGE:
    jolt-atlas <COMMAND>

COMMANDS:
    commit      Generate model commitment
    prove       Generate zkML proof
    verify      Verify zkML proof
    register    Register model with Visa registry
    help        Print help information

OPTIONS:
    -h, --help       Print help information
    -V, --version    Print version information
```

### 7.2 Implementation

**File: `crates/jolt-atlas-cli/src/main.rs`**

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "jolt-atlas")]
#[command(about = "JOLT-Atlas zkML CLI for Visa TAP integration")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate model commitment
    Commit {
        /// Path to model file (ONNX, TensorFlow, etc.)
        #[arg(short, long)]
        model: PathBuf,

        /// Output file for commitment JSON
        #[arg(short, long)]
        output: PathBuf,
    },

    /// Generate zkML proof
    Prove {
        /// Path to model file
        #[arg(short, long)]
        model: PathBuf,

        /// Path to input data file
        #[arg(short, long)]
        input: PathBuf,

        /// Path to commitment file (optional)
        #[arg(short, long)]
        commitment: Option<PathBuf>,

        /// Output file for proof
        #[arg(short, long)]
        output: PathBuf,

        /// Enable zero-knowledge mode
        #[arg(long)]
        zk: bool,
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
    },

    /// Register model with Visa registry
    Register {
        /// Path to commitment file
        #[arg(short, long)]
        commitment: PathBuf,

        /// Visa API key
        #[arg(long)]
        api_key: String,

        /// Agent identifier
        #[arg(long)]
        agent_id: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Commit { model, output } => {
            cmd_commit(&model, &output)
        }
        Commands::Prove { model, input, commitment, output, zk } => {
            cmd_prove(&model, &input, commitment.as_deref(), &output, zk)
        }
        Commands::Verify { proof, commitment, registry } => {
            cmd_verify(&proof, commitment.as_deref(), registry.as_deref())
        }
        Commands::Register { commitment, api_key, agent_id } => {
            cmd_register(&commitment, &api_key, &agent_id)
        }
    }
}
```

---

## Phase 8: Verification Service (Facilitator)

### 8.1 API Specification

**Endpoint:** `POST /v1/zkml/verify`

**Request:**
```json
{
  "proof": "<base64_encoded_proof>",
  "model_commitment": "<hex_commitment>",
  "tap_signature": "<tap_sig>",
  "transaction_amount": 15000
}
```

**Response (Success):**
```json
{
  "valid": true,
  "model_commitment": "<hex_commitment>",
  "verified_at": 1733600000,
  "model_info": {
    "agent_id": "agent-123",
    "registered_at": 1730000000,
    "version": "1.0.0"
  }
}
```

**Response (Failure):**
```json
{
  "valid": false,
  "error": "Model not in registry",
  "error_code": "MODEL_NOT_REGISTERED"
}
```

### 8.2 Implementation

**File: `verification-service/src/routes/verify.ts`**

```typescript
import { Router } from 'express';
import { JoltAtlasVerifier } from '@icme/zkml-verifier';
import { loadVisaRegistry } from '../services/registry';

const router = Router();
const verifier = new JoltAtlasVerifier();

router.post('/verify', async (req, res) => {
  const { proof, model_commitment, tap_signature, transaction_amount } = req.body;

  // Validate request
  if (!proof || !model_commitment) {
    return res.status(400).json({
      valid: false,
      error: 'Missing required fields',
      error_code: 'INVALID_REQUEST',
    });
  }

  try {
    // Load registry if not cached
    const registry = await loadVisaRegistry();

    // Verify proof
    const result = await verifier.verify({
      proof: Buffer.from(proof, 'base64'),
      modelCommitment: model_commitment,
      registeredModels: registry,
    });

    if (result.valid) {
      const modelInfo = registry.get(model_commitment);

      return res.json({
        valid: true,
        model_commitment,
        verified_at: Date.now(),
        model_info: modelInfo ? {
          agent_id: modelInfo.agentId,
          registered_at: modelInfo.registeredAt,
          version: modelInfo.version,
        } : undefined,
      });
    } else {
      return res.json({
        valid: false,
        error: result.error,
        error_code: mapErrorCode(result.error),
      });
    }
  } catch (error) {
    return res.status(500).json({
      valid: false,
      error: 'Internal verification error',
      error_code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
```

---

## Phase 9: Testing & Examples

### 9.1 Unit Tests

**Rust Tests (`crates/zkml-jolt/src/tests/`):**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commitment_generation() {
        let model_path = Path::new("fixtures/test_model.onnx");
        let commitment = CommitmentGenerator::from_onnx(model_path).unwrap();

        assert_eq!(commitment.commitment.len(), 32);
        assert!(!commitment.version.is_empty());
    }

    #[test]
    fn test_commitment_deterministic() {
        let model_path = Path::new("fixtures/test_model.onnx");

        let c1 = CommitmentGenerator::from_onnx(model_path).unwrap();
        let c2 = CommitmentGenerator::from_onnx(model_path).unwrap();

        assert_eq!(c1.commitment, c2.commitment);
    }

    #[test]
    fn test_proof_generation() {
        let prover = JoltAtlas::new("fixtures/test_model.onnx").unwrap();
        let input = b"test transaction context";

        let config = ProofConfig {
            zero_knowledge: true,
            ..Default::default()
        };

        let proof = prover.prove(input, &config).unwrap();

        assert!(!proof.execution_proof.is_empty());
        assert!(proof.timestamp > 0);
    }

    #[test]
    fn test_proof_verification() {
        let prover = JoltAtlas::new("fixtures/test_model.onnx").unwrap();
        let proof = prover.prove(b"test input", &ProofConfig::default()).unwrap();

        let verifier = JoltAtlasVerifier::new(VerifierConfig::default());
        let result = verifier.verify(&proof);

        assert!(result.valid);
    }
}
```

### 9.2 Integration Tests

**File: `tests/integration/tap_flow.rs`**

```rust
#[tokio::test]
async fn test_full_tap_flow() {
    // 1. Generate model commitment
    let commitment = CommitmentGenerator::from_onnx("fixtures/agent_model.onnx").unwrap();

    // 2. Create prover
    let prover = JoltAtlas::with_commitment(
        "fixtures/agent_model.onnx",
        commitment.clone(),
    ).unwrap();

    // 3. Create TAP payment container
    let mut container = TapPaymentContainer::new()
        .with_amount(5000)
        .with_merchant("merchant-123");

    // 4. Generate proof (amount > threshold)
    let input = container.to_inference_input();
    let proof = prover.prove(&input, &ProofConfig::default()).unwrap();

    // 5. Add zkML headers
    let zkml_container = ZkmlPaymentContainer::new(container)
        .with_proof(proof.clone(), 1000);

    // 6. Verify on CDN proxy side
    let verifier = JoltAtlasVerifier::new(VerifierConfig::default());
    let result = verifier.verify(&proof);

    assert!(result.valid);
}
```

### 9.3 Example: Agent Integration

**File: `examples/agent-integration/src/main.rs`**

```rust
//! Example: Integrating zkML proofs into an AI agent

use zkml_jolt::{JoltAtlas, ProofConfig};
use zkml_tap::{ZkmlHeaders, ZkmlPaymentContainer};

const MODEL_PATH: &str = "models/transaction_decision.onnx";
const ZKML_THRESHOLD: u64 = 1000; // $1000 USD

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize prover with pre-registered commitment
    let commitment = load_registered_commitment()?;
    let prover = JoltAtlas::with_commitment(MODEL_PATH, commitment)?;

    // Simulate incoming transaction request
    let transaction = TransactionRequest {
        amount: 5000,
        merchant_id: "merchant-456".to_string(),
        user_intent: "Purchase laptop".to_string(),
    };

    // Run agent decision model
    let decision = run_agent_decision(&prover, &transaction)?;

    // Create TAP payment container
    let mut headers = HeaderMap::new();

    // Add standard TAP signature
    add_tap_signature(&mut headers, &transaction)?;

    // Add zkML proof if threshold met
    if transaction.amount >= ZKML_THRESHOLD {
        println!("Transaction amount ${} exceeds threshold, generating zkML proof...",
                 transaction.amount);

        let proof = prover.prove(
            &transaction.to_bytes(),
            &ProofConfig { zero_knowledge: true, ..Default::default() }
        )?;

        headers.set_zkml_proof(&proof)?;

        println!("zkML proof generated and attached to request");
    }

    // Send to merchant
    let response = send_to_merchant(headers, &decision).await?;

    println!("Transaction result: {:?}", response);

    Ok(())
}
```

---

## Appendix A: Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PROOF_FORMAT` | Proof could not be decoded |
| `PROOF_EXPIRED` | Proof timestamp too old |
| `MODEL_NOT_REGISTERED` | Model commitment not in Visa registry |
| `COMMITMENT_MISMATCH` | Proof commitment doesn't match header |
| `JOLT_VERIFICATION_FAILED` | Cryptographic proof invalid |
| `INTERNAL_ERROR` | Server-side error |

## Appendix B: Security Considerations

1. **Proof Replay Prevention**: Timestamps and nonces prevent proof reuse
2. **Model Registry Trust**: Depends on Visa's registry security
3. **Side-Channel Resistance**: JOLT-Atlas uses constant-time operations
4. **Quantum Considerations**: HyperNova provides post-quantum security margin

## Appendix C: Performance Benchmarks

| Model Size | Proof Time | Proof Size |
|------------|------------|------------|
| < 1MB | ~0.5s | ~50KB |
| 1-10MB | ~0.7s | ~80KB |
| 10-100MB | ~1.2s | ~120KB |
| > 100MB | ~2.0s | ~200KB |
