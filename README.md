# Spending Policy Compliance for Visa TAP

**TAP verifies WHO. zkML verifies WHAT and HOW.**

Cryptographic proof that AI agents follow spending rules on Circle Arc

Built with [JOLT-Atlas zero-knowledge machine learning](https://github.com/ICME-Lab/jolt-atlas)

---

## The Problem

Visa's Trusted Agent Protocol (TAP) launched October 2025 with cryptographic identity verification via RFC 9421 HTTP Message Signatures. TAP verifies **WHO** the agent is—but not:

- **WHAT** model is running
- **HOW** the decision was computed
- Whether the model was **swapped post-certification**

As Visa scales to millions of agentic USDC transactions in 2026 ($3.5B+ settlement volume today), this gap creates critical vulnerabilities:

| Attack Vector | TAP Coverage | Impact |
|---------------|--------------|--------|
| Model substitution | Not detected | Malicious model processes settlements |
| Post-certification tampering | Not detected | Certified agent compromised |
| Decision audit disputes | No proof | Liability unclear in chargebacks |

## The Solution

JOLT-Atlas zkML adds a single TAP header extension (`X-ZKML-PROOF`) that cryptographically proves:

1. **Which exact model** made the decision (commitment binding)
2. **How it computed** the output (ZK proof of execution)
3. **Immutable audit trail** anchored on Circle Arc

```
TAP Identity Verification  +  zkML Model Verification  =  Complete Agent Trust
         (WHO)                       (WHAT + HOW)
```

## Key Metrics

| Metric | Value | Context |
|--------|-------|---------|
| Proof Generation | **0.7 seconds** | Fits real-time payment latency |
| vs Competitors | **3-7x faster** | EZKL: 4-5s, mina-zkml: 2s |
| Settlement Anchor | **Circle Arc** | Visa is a design partner |
| Backward Compatible | **100%** | TAP header extension only |

## Demo

The interactive demo shows a $75,000 B2B USDC settlement with:

- **TAP + Model Verification** vs **TAP Identity Only** comparison
- **Model Substitution Attack** visualization (TAP passes, zkML blocks)
- **Business Outcomes**: Chargeback protection, audit compliance, liability clarity
- **Circle Arc** settlement anchoring

```bash
cd demo
npm install
npm run dev
```

### Real On-Chain Transactions

The demo supports **real on-chain transactions** on Arc Testnet. Enable "Real Tx" toggle to:

| Transaction | What's Anchored | On-Chain |
|-------------|-----------------|----------|
| **Attestation** | WHO (agentId) + WHAT (inputHash) + HOW (proofHash, modelHash) | ✓ Real |
| **USDC Transfer** | $0.01 settlement to demo merchant | ✓ Real |

**On-Chain Attestation Structure:**
```solidity
attestProofWithAgent(
  bytes32 agentId,      // TAP agent identity (WHO)
  bytes32 proofHash,    // SNARK proof hash (HOW)
  bytes32 modelHash,    // Policy model commitment (WHAT model)
  bytes32 inputHash     // Transaction inputs (WHAT data)
)
```

**Contract Addresses (Arc Testnet):**
| Contract | Address |
|----------|---------|
| USDC | `0x1Fb62895099b7931FFaBEa1AdF92e20Df7F29213` |
| ProofAttestation | `0xBE9a5DF7C551324CB872584C6E5bF56799787952` |
| SpendingGate | `0x6A47D13593c00359a1c5Fc6f9716926aF184d138` |

**Demo Wallet:** `0xB624E375BBc7834201ff716516249d7eE99Ad362`

View transactions on [Arc Testnet Explorer](https://testnet.arcscan.app)

## How It Works

### 1. Agent Certification

When an AI agent is certified through Visa's Intelligent Commerce program, it commits to its model:

```
commitment = keccak256(model_weights || architecture || version)
```

This commitment is registered with Visa's model registry.

### 2. Transaction Processing

For high-value settlements (e.g., >$10,000 USDC):

```
Agent                           Merchant/Visa
  │                                   │
  │  1. Load certified model          │
  │  2. Run inference                 │
  │  3. Generate ZK proof (0.7s)      │
  │  4. Anchor on Circle Arc          │
  │                                   │
  │ ─────── TAP + X-ZKML-PROOF ─────► │
  │                                   │
  │                    5. Verify TAP signature
  │                    6. Check model registry
  │                    7. Verify ZK proof
  │                    8. Confirm Arc anchor
  │                                   │
  │ ◄─────── Settlement Approved ──── │
```

### 3. TAP Header Extension

```http
POST /v1/settlements HTTP/1.1
Signature: <RFC 9421 TAP signature>
X-ZKML-PROOF: base64(jolt_atlas_proof)
X-ZKML-MODEL-COMMITMENT: keccak256(...)
X-ZKML-ARC-TX: 0xarc_7f3c2e8d1b4f5...
X-ZKML-THRESHOLD: 10000
X-ZKML-TIMESTAMP: 1734890400

{
  "amount": 75000,
  "currency": "USDC",
  "recipient": "GlobalTech Suppliers Inc."
}
```

## Business Value

### For Visa

- **Competitive advantage**: Mastercard/Google AP2 cannot match zkML verification
- **Risk reduction**: Block model substitution attacks on $3.5B+ USDC settlements
- **Arc ecosystem**: Native integration with Circle partnership

### For Merchants

- **Chargeback protection**: Cryptographic proof of model behavior
- **Audit compliance**: Immutable Arc-anchored decision trail
- **Liability clarity**: Proof links decision to specific certified model

### For Agents

- **Premium tier**: "Verified AI" designation for higher transaction limits
- **Trust signal**: Differentiate from unverified competitors
- **Dispute defense**: Evidence in contested transactions

## Repository Structure

```
visa-tap-zkml/
├── crates/                      # Rust implementations
│   ├── zkml-jolt/              # Core zkML proving library
│   ├── zkml-tap/               # TAP integration layer
│   └── jolt-atlas-cli/         # CLI tool
│
├── packages/                    # Node.js implementations
│   ├── jolt-atlas/             # Core SDK (@icme/jolt-atlas)
│   └── zkml-verifier/          # Verifier package
│
├── cdn-proxy/                   # Merchant CDN integration
├── verification-service/        # Facilitator endpoint
├── demo/                        # Interactive demo
└── examples/                    # Integration examples
```

## Quick Start

### Agent Integration (Rust)

```rust
use zkml_jolt::{JoltAtlas, ProofConfig};

// Load certified model
let prover = JoltAtlas::new(model_path)?;

// Generate proof (~0.7s)
let proof = prover.prove(settlement_input, &ProofConfig {
    zero_knowledge: true,
    model_commitment: visa_registered_commitment,
    anchor_to_arc: true,
})?;

// Add to TAP headers
headers.set("X-ZKML-PROOF", base64::encode(&proof.proof));
headers.set("X-ZKML-MODEL-COMMITMENT", &proof.commitment);
headers.set("X-ZKML-ARC-TX", &proof.arc_tx_hash);
```

### Merchant Verification (TypeScript)

```typescript
import { JoltAtlasVerifier } from "@icme/zkml-verifier";

const verifier = new JoltAtlasVerifier({
  registryUrl: "https://registry.visa.com/models",
  arcRpcUrl: "https://arc.circle.com/rpc",
});

const result = await verifier.verify({
  proof: request.headers["x-zkml-proof"],
  modelCommitment: request.headers["x-zkml-model-commitment"],
  arcTxHash: request.headers["x-zkml-arc-tx"],
  settlementAmount: 75000,
});

if (result.valid) {
  // Proceed with USDC settlement
}
```

## Verification Options

### Option A: Facilitator-Based (Recommended)

```bash
POST https://verify.novanet.xyz/v1/zkml/verify
{
  "proof": "<base64>",
  "model_commitment": "<hex>",
  "arc_tx_hash": "<arc_hash>",
  "settlement_amount": 75000,
  "currency": "USDC"
}
```

### Option B: Local Verification

```bash
npm install @icme/zkml-verifier
```

## Alignment with Visa Strategy

| Visa Initiative | JOLT-Atlas Alignment |
|-----------------|---------------------|
| TAP (Oct 2025) | Extends TAP with model verification headers |
| USDC Settlement (Dec 2025) | Native USDC support, $3.5B+ volume ready |
| Circle Arc Partnership | Proof anchoring on Arc blockchain |
| Millions of agents by 2026 | Scalable 0.7s proof generation |
| 4,700% bot traffic surge | Blocks post-certification model swaps |

## Resources

### Visa TAP
- [Visa TAP Announcement](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.21716.html)
- [Developer Documentation](https://developer.visa.com/capabilities/trusted-agent-protocol)

### Circle Arc / USDC
- [Visa USDC Settlement](https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.21951.html)
- [Circle Arc](https://www.circle.com/arc)

### JOLT-Atlas
- [ICME zkml-jolt](https://github.com/ICME-Lab/zkml-jolt)
- [Technical Blog](https://blog.icme.io/sumcheck-good-lookups-good-jolt-good-particularly-for-zero-knowledge-machine-learning/)
- [JOLT Paper](https://eprint.iacr.org/2023/1217)

## License

MIT License - see LICENSE file for details.

---

**TAP solves agent identity. We solve model integrity.**

*Built for Visa TAP • Circle Arc Native • USDC Ready*
