# API Reference

## HTTP Headers

### Request Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-ZKML-PROOF` | string | Yes* | Base64-encoded JOLT-Atlas proof |
| `X-ZKML-MODEL-COMMITMENT` | string | Yes* | Hex-encoded model commitment (64 chars) |
| `X-ZKML-THRESHOLD` | number | No | USD threshold that triggered proof |
| `X-ZKML-TIMESTAMP` | number | Yes* | Unix timestamp of proof generation |
| `X-ZKML-VERSION` | number | No | Proof format version |

*Required when transaction amount >= threshold

## Verification API

### POST /v1/zkml/verify

Verify a zkML proof.

**Request:**

```json
{
  "proof": "base64_encoded_proof",
  "model_commitment": "hex_encoded_commitment",
  "tap_signature": "optional_tap_signature",
  "transaction_amount": 15000
}
```

**Response (Success):**

```json
{
  "valid": true,
  "model_commitment": "0x1234...",
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
  "error": "Proof expired",
  "error_code": "PROOF_EXPIRED"
}
```

### GET /v1/zkml/models/:commitment

Get information about a registered model.

**Response:**

```json
{
  "commitment": "0x1234...",
  "agent_id": "agent-123",
  "registered_at": 1730000000,
  "version": "1.0.0",
  "name": "Transaction Decision Model",
  "active": true
}
```

### POST /v1/zkml/models

Register a new model (requires API key).

**Headers:**
- `X-API-Key`: Your API key

**Request:**

```json
{
  "commitment": "0x1234...",
  "agent_id": "agent-123",
  "version": "1.0.0",
  "name": "Transaction Decision Model"
}
```

**Response:**

```json
{
  "commitment": "0x1234...",
  "agent_id": "agent-123",
  "registered_at": 1733600000,
  "version": "1.0.0",
  "name": "Transaction Decision Model",
  "active": true
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Missing required fields |
| `INVALID_PROOF_FORMAT` | Proof could not be decoded |
| `PROOF_EXPIRED` | Proof timestamp too old (>5 minutes) |
| `MODEL_NOT_REGISTERED` | Model not in Visa registry |
| `COMMITMENT_MISMATCH` | Proof commitment doesn't match header |
| `JOLT_VERIFICATION_FAILED` | Cryptographic proof invalid |
| `INTERNAL_ERROR` | Server-side error |

## Type Definitions

### JoltAtlasProof

```typescript
interface JoltAtlasProof {
  modelCommitment: ModelCommitment;
  inputCommitment: InputCommitment;
  outputCommitment: OutputCommitment;
  executionProof: string;  // base64
  timestamp: number;
  version: number;
}
```

### ModelCommitment

```typescript
interface ModelCommitment {
  weightsHash: string;       // hex, 64 chars
  architectureHash: string;  // hex, 64 chars
  commitment: string;        // hex, 64 chars
  version: string;
  createdAt: number;
}
```

### VerificationResult

```typescript
interface VerificationResult {
  valid: boolean;
  modelCommitment: string;
  verifiedAt: number;
  error?: string;
}
```

### DecisionType

```typescript
enum DecisionType {
  Approve = 'approve',
  Deny = 'deny',
  Escalate = 'escalate',
  Defer = 'defer',
}
```

## SDK Methods

### Rust

```rust
// Commitment generation
CommitmentGenerator::from_onnx(path) -> Result<ModelCommitment>
CommitmentGenerator::from_components(weights, arch, version) -> Result<ModelCommitment>

// Proof generation
JoltAtlas::new(path) -> Result<Self>
JoltAtlas::with_commitment(path, commitment) -> Result<Self>
JoltAtlas::prove(&self, input, config) -> Result<JoltAtlasProof>
JoltAtlas::prove_batch(&self, inputs, config) -> Result<Vec<JoltAtlasProof>>

// Verification
JoltAtlasVerifier::new(config) -> Self
JoltAtlasVerifier::verify(&self, proof) -> VerificationResult
JoltAtlasVerifier::verify_batch(&self, proofs) -> Vec<VerificationResult>
JoltAtlasVerifier::load_registry(&self, url) -> Result<usize>
```

### TypeScript

```typescript
// Commitment generation
CommitmentGenerator.fromBytes(bytes, version) -> ModelCommitment
CommitmentGenerator.fromComponents(weights, arch, version) -> ModelCommitment

// Proof generation
new JoltAtlas(modelBytes)
JoltAtlas.withCommitment(bytes, commitment) -> JoltAtlas
prover.prove(input, config) -> Promise<JoltAtlasProof>
prover.proveBatch(inputs, config) -> Promise<JoltAtlasProof[]>

// Verification
new JoltAtlasVerifier(config?)
verifier.verify(proof) -> Promise<VerificationResult>
verifier.verifyBatch(proofs) -> Promise<VerificationResult[]>
verifier.loadRegistry(url) -> Promise<number>
```
