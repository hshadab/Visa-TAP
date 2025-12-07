# JOLT-Atlas zkML Integration Specification

**High-Value Transaction Verification for Visa Trusted Agent Protocol**

ICME Labs / NovaNet • December 2025 • v1.0

---

## Executive Summary

This specification defines the integration of ICME Labs' JOLT-Atlas zero-knowledge machine learning (zkML) technology with Visa's Trusted Agent Protocol (TAP) to enable cryptographic verification of AI agent model execution for high-value transactions.

| Aspect | Description |
|--------|-------------|
| **Problem** | Visa TAP verifies agent identity via cryptographic signatures but cannot verify what model an agent is running or how it made a transaction decision. Post-certification model substitution is undetectable. |
| **Solution** | JOLT-Atlas zkML proofs embedded in TAP's Agentic Payment Container provide cryptographic proof that a specific, approved model version executed correctly to produce a transaction decision. |
| **Performance** | 0.7-second proof generation (3-7x faster than competitors) enables real-time verification within acceptable payment latency. |
| **Target** | Transactions above configurable thresholds (e.g., $1,000+) where additional verification latency is acceptable. |

---

## Context & Background

### Visa Trusted Agent Protocol (TAP)

Visa launched TAP in October 2025 in collaboration with Cloudflare. The protocol uses RFC 9421 HTTP Message Signatures with Ed25519 public key cryptography to verify AI agent identity and authorization.

#### TAP Architecture Components

| Component | Description |
|-----------|-------------|
| **Agent Recognition Signatures** | Prove agent identity via Visa-registered key pairs |
| **Consumer Recognition Tokens** | Link agents to authenticated consumers |
| **Payment Containers** | Carry transaction credentials and intent data |
| **Agent Registry** | Public key directory for signature verification |

#### TAP Limitations (Gap Analysis)

| Limitation | Impact |
|------------|--------|
| No model integrity verification | Agents could be modified post-certification |
| Identity ≠ behavior | TAP verifies WHO, not WHAT or HOW |
| No privacy-preserving audit | Cannot audit transaction decisions without exposing data |
| Centralized certification | No cryptographic proof of compliance |

### JOLT-Atlas zkML

JOLT-Atlas is ICME Labs' optimized implementation of the a16z JOLT zkVM, specialized for machine learning inference verification. It generates zero-knowledge proofs that a specific model executed correctly without revealing model weights, inputs, or intermediate computations.

#### Performance Benchmarks

| Framework | Proof Time | Speedup | True ZK |
|-----------|------------|---------|---------|
| **JOLT-Atlas (ICME)** | ~0.7s | Baseline | Yes (HyperNova) |
| mina-zkml | ~2.0s | 2.9x slower | No |
| EZKL | 4-5s | 6-7x slower | No |

---

## Technical Specification

### Integration Architecture

The integration adds a zkML verification layer to TAP's existing signature-based authentication flow. For transactions above the configured threshold, agents generate and include JOLT-Atlas proofs alongside standard TAP signatures.

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         zkML-Enhanced TAP Flow                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CERTIFICATION PHASE                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Agent commits to model (hash of parameters + architecture)     │    │
│  │  during Visa Intelligent Commerce certification                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  2. TRANSACTION PHASE                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  For high-value transactions (> threshold):                     │    │
│  │  - Agent runs inference on transaction context                  │    │
│  │  - Agent generates zkML proof (~0.7s)                          │    │
│  │  - Proof embedded in TAP Payment Container                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│                                    ▼                                     │
│  3. VERIFICATION PHASE                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Merchant/CDN verifies:                                         │    │
│  │  - TAP signature (identity)                                     │    │
│  │  - zkML proof (model execution)                                 │    │
│  │  On success: Transaction proceeds with enhanced trust           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Message Format

The zkML proof is included as additional headers within the TAP Agentic Payment Container:

```http
POST /api/payment HTTP/1.1
Host: merchant.example.com
Content-Type: application/json

# Standard TAP Headers
Signature-Input: sig1=("@method" "@path" "content-type" "content-digest");created=1733600000;keyid="visa-agent-key-123"
Signature: sig1=:base64_ed25519_signature:

# zkML Extension Headers
X-ZKML-PROOF: base64(jolt_atlas_proof)
X-ZKML-MODEL-COMMITMENT: keccak256(model_weights || architecture)
X-ZKML-THRESHOLD: 1000
X-ZKML-TIMESTAMP: 1733600000
X-ZKML-VERSION: 1

# Request Body
{
  "amount": 5000,
  "currency": "USD",
  "merchant_id": "merchant-456",
  "agent_intent": "Purchase electronics as authorized by user"
}
```

### Proof Structure

JOLT-Atlas proofs contain the following components:

| Field | Type | Description |
|-------|------|-------------|
| `model_commitment` | bytes32 | Hash binding proof to specific model version |
| `input_commitment` | bytes32 | Hash of transaction context (privacy-preserving) |
| `output_commitment` | bytes32 | Hash of decision output |
| `execution_proof` | bytes | Cryptographic proof of correct computation |
| `timestamp` | uint64 | Proof generation time for freshness |
| `version` | uint32 | Proof format version |

### Commitment Generation

The model commitment cryptographically binds a proof to a specific model:

```
model_commitment = keccak256(
    keccak256(model_weights) ||
    keccak256(architecture_spec) ||
    encode(version)
)
```

This ensures:
1. Any change to weights invalidates the commitment
2. Architecture changes are detected
3. Version tracking for upgrade paths

---

## Verification Endpoints

Two verification modes are supported:

### Option A: Facilitator-Based Verification

Merchant sends proof to ICME Labs facilitator endpoint:

**Endpoint:** `POST https://verify.novanet.xyz/v1/zkml/verify`

**Request:**
```json
{
  "proof": "<base64_proof>",
  "model_commitment": "<hex_commitment>",
  "tap_signature": "<tap_sig>",
  "transaction_amount": 15000
}
```

**Response:**
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

### Option B: Local Verification

Merchants verify proofs locally using JOLT-Atlas verifier library:

```typescript
import { JoltAtlasVerifier } from "@icme/zkml-verifier";

const verifier = new JoltAtlasVerifier();
const result = await verifier.verify({
  proof: proofBytes,
  modelCommitment: commitment,
  registeredModels: await fetchVisaModelRegistry()
});

if (result.valid) {
  console.log("Proof verified for model:", result.modelCommitment);
} else {
  console.error("Verification failed:", result.error);
}
```

---

## Implementation Guide

### For Agent Developers

#### Step 1: Model Registration

Register your model with Visa's Intelligent Commerce program and generate model commitment:

```bash
# Using JOLT-Atlas CLI
jolt-atlas commit --model ./agent_model.onnx --output commitment.json
```

Output:
```json
{
  "commitment": "0x1a2b3c4d...",
  "weights_hash": "0xabcd...",
  "architecture_hash": "0xef01...",
  "version": "1.0.0",
  "created_at": 1733600000
}
```

#### Step 2: SDK Integration

Install JOLT-Atlas SDK:

```bash
# Rust
cargo add zkml-jolt

# Node.js
npm install @icme/jolt-atlas
```

#### Step 3: Proof Generation (Rust)

```rust
use zkml_jolt::{JoltAtlas, ProofConfig};

// Initialize with registered model
let prover = JoltAtlas::new(model_path)?;

let config = ProofConfig {
    zero_knowledge: true,
    model_commitment: registered_commitment,
};

// Generate proof (~0.7s)
let proof = prover.prove(input_data, &config)?;

// Serialize for transmission
let proof_bytes = proof.to_bytes()?;
let proof_base64 = base64::encode(&proof_bytes);
```

#### Step 4: TAP Integration

```rust
use zkml_tap::ZkmlHeaders;

// Build request with TAP signature
let mut headers = build_tap_headers(&transaction)?;

// Add zkML proof headers
headers.insert("X-ZKML-PROOF", proof_base64.parse()?);
headers.insert("X-ZKML-MODEL-COMMITMENT", hex::encode(&commitment));
headers.insert("X-ZKML-THRESHOLD", threshold.to_string().parse()?);
headers.insert("X-ZKML-TIMESTAMP", timestamp.to_string().parse()?);

// Send request
client.post(merchant_url).headers(headers).send().await?;
```

### For Merchants

#### CDN Proxy Integration

Extend Visa's CDN proxy sample to verify zkML proofs:

```typescript
// In cdn-proxy/src/verify.ts

import { JoltAtlasVerifier } from '@icme/zkml-verifier';

const verifier = new JoltAtlasVerifier();

export async function verifyZkmlProof(req: Request): Promise<ZkmlResult> {
  const proof = req.headers["x-zkml-proof"];
  const commitment = req.headers["x-zkml-model-commitment"];

  // No proof header = not required for this transaction
  if (!proof) {
    return { zkml: "not_required" };
  }

  // Facilitator verification
  const response = await fetch("https://verify.novanet.xyz/v1/zkml/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proof, model_commitment: commitment })
  });

  const result = await response.json();

  return {
    zkml: result.valid ? "verified" : "failed",
    error: result.error,
    modelCommitment: result.model_commitment
  };
}

// Middleware usage
app.use(async (req, res, next) => {
  // First verify TAP signature
  const tapResult = await verifyTapSignature(req);
  if (!tapResult.valid) {
    return res.status(401).json({ error: "TAP signature invalid" });
  }

  // Then verify zkML proof
  const zkmlResult = await verifyZkmlProof(req);
  if (zkmlResult.zkml === "failed") {
    return res.status(403).json({ error: "zkML verification failed" });
  }

  // Both verified - proceed
  req.verification = { tap: tapResult, zkml: zkmlResult };
  next();
});
```

---

## Value Proposition

### For Visa

| Benefit | Description |
|---------|-------------|
| **Differentiation** | Capability Mastercard and Google AP2 cannot match |
| **Fraud Reduction** | Cryptographic proof prevents model substitution attacks |
| **Liability Clarity** | Audit trail links user intent → model execution → payment |
| **Premium Tier** | "Verified AI" certification tier for agents |
| **No Internal Build** | Specialized cryptographic expertise via partnership |

### For Merchants

| Benefit | Description |
|---------|-------------|
| **Trust** | Cryptographic assurance agent decisions are legitimate |
| **Chargeback Protection** | Proof of agent behavior for dispute resolution |
| **Compliance** | Privacy-preserving audit capability |

### For Agents

| Benefit | Description |
|---------|-------------|
| **Premium Access** | Higher transaction limits with verified status |
| **Trust Signaling** | Differentiate from lower-tier agents |
| **Cross-Protocol** | Portable verification across payment networks |

---

## Competitive Positioning

### Market Landscape

| Protocol | Identity Verification | Model Verification | Privacy |
|----------|----------------------|-------------------|---------|
| **Visa TAP + zkML** | ✓ RFC 9421 | ✓ zkML Proofs | ✓ Zero-Knowledge |
| Visa TAP (current) | ✓ RFC 9421 | ✗ None | ✗ None |
| Mastercard Agent Pay | ✓ HTTP Signatures | ✗ None | ✗ None |
| Google AP2 | ✓ Mandates | ✗ None | ✗ None |
| x402 + zkML | ✓ EIP-712 | ✓ zkML Proofs | ✓ Zero-Knowledge |

ICME Labs' existing x402 + zkML integration (Verifiable Agent Kit) demonstrates the technical approach. Visa TAP integration extends this capability to traditional card rails.

---

## Proposed Timeline

### Phase 1: Technical Validation (Q1 2026)

- [ ] Proof-of-concept integration with TAP sample repository
- [ ] Define message format and verification endpoint specs
- [ ] Benchmark latency impact on transaction flow
- [ ] Security review of proof format

### Phase 2: Pilot Program (Q2 2026)

- [ ] Select 3-5 early adopter agents for pilot
- [ ] Deploy verification facilitator infrastructure
- [ ] Integrate with Visa Intelligent Commerce APIs
- [ ] Collect performance and reliability metrics

### Phase 3: General Availability (Q3 2026)

- [ ] SDK release for agent developers
- [ ] "Verified AI" certification tier launch
- [ ] Merchant CDN integration guides
- [ ] Public documentation and support

---

## Public Resources & Documentation

### Visa TAP Resources

| Resource | URL |
|----------|-----|
| GitHub Repository | https://github.com/visa/trusted-agent-protocol |
| Developer Documentation | https://developer.visa.com/capabilities/trusted-agent-protocol |
| TAP Specifications | https://developer.visa.com/capabilities/trusted-agent-protocol/trusted-agent-protocol-specifications |

### JOLT & JOLT-Atlas Resources

| Resource | URL |
|----------|-----|
| a16z JOLT (Base) | https://github.com/a16z/jolt |
| ICME zkml-jolt (JOLT-Atlas) | https://github.com/ICME-Lab/zkml-jolt |
| Technical Blog | https://blog.icme.io/sumcheck-good-lookups-good-jolt-good-particularly-for-zero-knowledge-machine-learning/ |
| JOLT Paper (ePrint) | https://eprint.iacr.org/2023/1217 |

### ICME Labs / NovaNet Resources

| Resource | URL |
|----------|-----|
| ICME Labs | https://www.icme.io/ |
| NovaNet | https://www.novanet.xyz/ |
| NovaNet Developer Docs | https://devs.novanet.xyz/ |
| Verifiable Agent Kit | https://github.com/ICME-Lab/verifiable-agent-kit |
| zkEngine (Dev) | https://github.com/ICME-Lab/zkEngine_dev |
| ICME Blog | https://blog.icme.io/ |

### Related Standards & Protocols

| Resource | URL |
|----------|-----|
| RFC 9421: HTTP Message Signatures | https://www.rfc-editor.org/rfc/rfc9421 |
| x402 Protocol | https://github.com/coinbase/x402 |
| x402 Documentation | https://docs.cdp.coinbase.com/x402/welcome |

---

## Contact

| Entity | URL |
|--------|-----|
| ICME Labs | https://www.icme.io/ |
| NovaNet | https://www.novanet.xyz/ |
| Technical Documentation | https://devs.novanet.xyz/ |

For partnership inquiries regarding Visa TAP integration, contact the ICME Labs business development team.
