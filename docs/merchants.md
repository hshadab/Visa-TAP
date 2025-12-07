# Merchant Integration Guide

This guide explains how to verify zkML proofs in incoming TAP payment requests.

## Overview

When processing high-value TAP transactions from AI agents, you can verify that the agent's model executed correctly by checking the zkML proof.

## Verification Options

### Option A: Facilitator Verification (Recommended for Quick Start)

Send proofs to NovaNet's verification facilitator:

```typescript
const response = await fetch('https://verify.novanet.xyz/v1/zkml/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    proof: headers['x-zkml-proof'],
    model_commitment: headers['x-zkml-model-commitment'],
  }),
});

const result = await response.json();
if (result.valid) {
  // Proceed with transaction
}
```

### Option B: Local Verification

Verify proofs locally for lower latency:

```typescript
import { JoltAtlasVerifier } from '@icme/zkml-verifier';

const verifier = new JoltAtlasVerifier();
const result = await verifier.verify({
  proof: proofBytes,
  modelCommitment: commitment,
});
```

## Express Middleware Integration

The easiest way to integrate is with the CDN proxy middleware:

```typescript
import express from 'express';
import { zkmlMiddleware } from '@visa-tap/cdn-proxy-zkml';

const app = express();

app.use('/api/payment', zkmlMiddleware({
  threshold: 1000, // $1000 USD
  verifyMode: 'local',
  blockMissingProofs: true,
  blockInvalidProofs: true,
}));

app.post('/api/payment', (req, res) => {
  // Request only reaches here if zkML verification passed
  const { zkmlVerification } = req;
  console.log('Verified model:', zkmlVerification.modelCommitment);

  // Process payment...
});
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `threshold` | 1000 | USD amount requiring proof |
| `verifyMode` | 'local' | 'local' or 'facilitator' |
| `blockMissingProofs` | true | Block if proof missing but required |
| `blockInvalidProofs` | true | Block if proof invalid |
| `facilitatorUrl` | NovaNet URL | Custom facilitator endpoint |

## Environment Variables

```bash
ZKML_THRESHOLD=1000
ZKML_VERIFY_MODE=local
ZKML_FACILITATOR_URL=https://verify.novanet.xyz/v1/zkml/verify
ZKML_BLOCK_MISSING=true
ZKML_BLOCK_INVALID=true
ZKML_DEBUG=false
```

## Handling Verification Results

The middleware attaches verification results to the request:

```typescript
interface ZkmlVerificationResult {
  zkml: 'verified' | 'not_required' | 'missing' | 'failed';
  error?: string;
  modelCommitment?: string;
  mode?: 'local' | 'facilitator';
}
```

### Response Codes

| Status | zkml | Action |
|--------|------|--------|
| 200 | verified | Proof valid, proceed |
| 200 | not_required | Below threshold, proceed |
| 403 | missing | Required proof missing |
| 403 | failed | Proof verification failed |

## Chargeback Protection

When a verified transaction is disputed:

1. Retrieve the stored zkML proof
2. Present to Visa with the verification result
3. The proof demonstrates the agent's model made the decision correctly

## Monitoring

Track these metrics:
- Verification success rate
- Average verification time
- Proofs by model commitment
- Failed verifications by error code

## Support

- Technical documentation: https://devs.novanet.xyz/
- ICME Labs: https://www.icme.io/
