# JOLT-Atlas zkML Integration for Visa TAP

**High-Value Transaction Verification for Visa Trusted Agent Protocol**

ICME Labs / NovaNet • December 2025 • v1.0

## Overview

This repository implements the integration of ICME Labs' JOLT-Atlas zero-knowledge machine learning (zkML) technology with Visa's Trusted Agent Protocol (TAP) to enable cryptographic verification of AI agent model execution for high-value transactions.

### Problem

Visa TAP verifies agent identity via cryptographic signatures but cannot verify:
- What model an agent is running
- How it made a transaction decision
- Post-certification model substitution

### Solution

JOLT-Atlas zkML proofs embedded in TAP's Agentic Payment Container provide cryptographic proof that a specific, approved model version executed correctly to produce a transaction decision.

### Performance

- **0.7-second proof generation** (3-7x faster than competitors)
- Enables real-time verification within acceptable payment latency
- Target: Transactions above configurable thresholds (e.g., $1,000+)

## Repository Structure

```
visa-tap-zkml/
├── README.md                    # This file
├── SPECIFICATION.md             # Full technical specification
├── IMPLEMENTATION_PLAN.md       # Detailed implementation plan
│
├── crates/                      # Rust implementations
│   ├── zkml-jolt/              # Core zkML proving library
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs          # Library entry point
│   │       ├── prover.rs       # Proof generation
│   │       ├── verifier.rs     # Proof verification
│   │       ├── commitment.rs   # Model commitment generation
│   │       ├── types.rs        # Core types and structures
│   │       └── config.rs       # Configuration
│   │
│   ├── zkml-tap/               # TAP integration layer
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── headers.rs      # TAP header extensions
│   │       ├── container.rs    # Payment container extensions
│   │       └── middleware.rs   # HTTP middleware
│   │
│   └── jolt-atlas-cli/         # CLI tool
│       ├── Cargo.toml
│       └── src/
│           └── main.rs
│
├── packages/                    # Node.js implementations
│   ├── jolt-atlas/             # Core SDK (@icme/jolt-atlas)
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── prover.ts
│   │       ├── verifier.ts
│   │       ├── types.ts
│   │       └── commitment.ts
│   │
│   └── zkml-verifier/          # Verifier-only package (@icme/zkml-verifier)
│       ├── package.json
│       └── src/
│           ├── index.ts
│           └── verifier.ts
│
├── cdn-proxy/                   # CDN proxy integration
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── verify.ts           # zkML verification
│       ├── middleware.ts       # Express middleware
│       └── config.ts
│
├── verification-service/        # Facilitator verification endpoint
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── routes/
│       │   └── verify.ts
│       └── services/
│           └── zkml.ts
│
├── examples/                    # Integration examples
│   ├── agent-integration/      # Agent developer example
│   ├── merchant-integration/   # Merchant integration example
│   └── full-flow/              # End-to-end example
│
├── tests/                       # Integration tests
│   ├── e2e/
│   └── integration/
│
└── docs/                        # Additional documentation
    ├── agent-developers.md
    ├── merchants.md
    ├── api-reference.md
    └── message-format.md
```

## Quick Start

### For Agent Developers

#### 1. Model Registration

Register your model with Visa's Intelligent Commerce program:

```bash
# Using JOLT-Atlas CLI
jolt-atlas commit --model ./agent_model.onnx --output commitment.json
```

#### 2. SDK Integration

```bash
# Rust
cargo add zkml-jolt

# Node.js
npm install @icme/jolt-atlas
```

#### 3. Proof Generation (Rust)

```rust
use zkml_jolt::{JoltAtlas, ProofConfig};

let prover = JoltAtlas::new(model_path)?;
let config = ProofConfig {
    zero_knowledge: true,
    model_commitment: registered_commitment,
};

// Generate proof (~0.7s)
let proof = prover.prove(input_data, &config)?;
```

#### 4. TAP Integration

```rust
// Add to TAP headers
headers.set("X-ZKML-PROOF", base64::encode(&proof));
headers.set("X-ZKML-MODEL-COMMITMENT", commitment);
```

### For Merchants

```typescript
import { JoltAtlasVerifier } from "@icme/zkml-verifier";

const verifier = new JoltAtlasVerifier();
const result = await verifier.verify({
  proof: proofBytes,
  modelCommitment: commitment,
  registeredModels: await fetchVisaModelRegistry()
});
```

## Message Format

zkML proofs are included as additional headers in TAP Payment Containers:

```
X-ZKML-PROOF: base64(jolt_atlas_proof)
X-ZKML-MODEL-COMMITMENT: keccak256(model_weights || architecture)
X-ZKML-THRESHOLD: 1000
X-ZKML-TIMESTAMP: 1733600000
```

## Verification Options

### Option A: Facilitator-Based Verification

```bash
POST https://verify.novanet.xyz/v1/zkml/verify
Content-Type: application/json

{
  "proof": "<base64_proof>",
  "model_commitment": "<hex_commitment>",
  "tap_signature": "<tap_sig>",
  "transaction_amount": 15000
}
```

### Option B: Local Verification

Use the `@icme/zkml-verifier` package for local verification.

## Resources

### Visa TAP
- [GitHub Repository](https://github.com/visa/trusted-agent-protocol)
- [Developer Documentation](https://developer.visa.com/capabilities/trusted-agent-protocol)

### JOLT-Atlas
- [ICME zkml-jolt](https://github.com/ICME-Lab/zkml-jolt)
- [Technical Blog](https://blog.icme.io/sumcheck-good-lookups-good-jolt-good-particularly-for-zero-knowledge-machine-learning/)
- [JOLT Paper](https://eprint.iacr.org/2023/1217)

### ICME Labs / NovaNet
- [ICME Labs](https://www.icme.io/)
- [NovaNet](https://www.novanet.xyz/)
- [Developer Docs](https://devs.novanet.xyz/)

## License

MIT License - see LICENSE file for details.
