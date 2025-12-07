# Agent Developer Guide

This guide explains how to integrate JOLT-Atlas zkML proofs into your AI agent for Visa TAP transactions.

## Overview

When your agent makes high-value transactions (above the configured threshold), you need to generate and attach zkML proofs to demonstrate that your certified model made the transaction decision.

## Prerequisites

1. A trained ML model (ONNX, TensorFlow, or PyTorch format)
2. Visa Intelligent Commerce certification
3. Registered model commitment with Visa

## Installation

### Rust

```bash
cargo add zkml-jolt zkml-tap
```

### Node.js

```bash
npm install @icme/jolt-atlas
```

## Step-by-Step Integration

### 1. Generate Model Commitment

During Visa certification, generate your model commitment:

```bash
jolt-atlas commit --model ./agent_model.onnx --output commitment.json
```

This produces a commitment file:

```json
{
  "commitment": "0x1a2b3c4d...",
  "weights_hash": "0xabcd...",
  "architecture_hash": "0xef01...",
  "version": "1.0.0",
  "created_at": 1733600000
}
```

### 2. Initialize the Prover

```rust
use zkml_jolt::{JoltAtlas, ProofConfig};

// Load with pre-registered commitment
let commitment = load_commitment("commitment.json")?;
let prover = JoltAtlas::with_commitment("model.onnx", commitment)?;
```

```typescript
import { JoltAtlas } from '@icme/jolt-atlas';

const modelBytes = fs.readFileSync('model.onnx');
const prover = new JoltAtlas(modelBytes);
```

### 3. Generate Proof for Transaction

```rust
let config = ProofConfig {
    zero_knowledge: true,
    threshold: Some(1000),
    ..Default::default()
};

// Input is the transaction context
let input = transaction.to_bytes();
let proof = prover.prove(&input, &config)?;
```

### 4. Add to TAP Headers

```rust
use zkml_tap::ZkmlHeaders;

let mut headers = HeaderMap::new();
headers.set_zkml_proof(&proof)?;
```

This adds the following headers:
- `X-ZKML-PROOF`: Base64-encoded proof
- `X-ZKML-MODEL-COMMITMENT`: Hex-encoded commitment
- `X-ZKML-THRESHOLD`: Threshold that triggered proof
- `X-ZKML-TIMESTAMP`: Proof generation time

### 5. Send Request

Include the headers in your TAP payment request alongside standard TAP signatures.

## Performance Considerations

| Model Size | Proof Time | Proof Size |
|------------|------------|------------|
| < 1MB | ~0.5s | ~50KB |
| 1-10MB | ~0.7s | ~80KB |
| 10-100MB | ~1.2s | ~120KB |

## Best Practices

1. **Cache the prover**: Initialize once, reuse for multiple proofs
2. **Generate proofs asynchronously**: Don't block the main transaction flow
3. **Handle failures gracefully**: Have fallback for proof generation errors
4. **Monitor proof times**: Log and alert on degraded performance

## Troubleshooting

### Commitment Mismatch Error

If you see "Commitment mismatch", your model file has changed since certification. You need to re-certify with Visa.

### Proof Expired Error

Proofs are only valid for 5 minutes. Generate proofs just-in-time before sending.

### Model Not Registered Error

Your model commitment isn't in Visa's registry. Complete the certification process.

## Support

- Technical documentation: https://devs.novanet.xyz/
- ICME Labs: https://www.icme.io/
