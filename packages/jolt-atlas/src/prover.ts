/**
 * JOLT-Atlas proof generation
 *
 * ⚠️ WARNING: MOCK IMPLEMENTATION
 *
 * This module contains **mock implementations** for demonstration purposes.
 * The following methods do NOT perform real cryptographic operations:
 *
 * - `executeInference()` - Returns deterministic mock outputs, not actual ML inference
 * - `generateZkProof()` - Creates mock proof structure, not real ZK proofs
 * - `generateTransparentProof()` - Creates mock transparent proofs
 *
 * **DO NOT USE IN PRODUCTION** without integrating real:
 * - ONNX.js or TensorFlow.js for model inference
 * - Actual ZK proving system
 *
 * Set ZKML_MOCK_WARNING=false to suppress runtime warnings.
 */

import { keccak256 } from 'js-sha3';

/**
 * Environment flag to suppress mock warnings
 */
const SUPPRESS_MOCK_WARNING = process.env.ZKML_MOCK_WARNING === 'false';
let mockWarningShown = false;
import {
  CommitmentGenerator,
  createInputCommitment,
  createOutputCommitment,
} from './commitment';
import {
  ModelCommitment,
  InputCommitment,
  OutputCommitment,
  JoltAtlasProof,
  ProofConfig,
  InferenceOutput,
  DecisionType,
  DEFAULT_PROOF_CONFIG,
  currentTimestamp,
} from './types';
import { PROOF_VERSION } from './index';

/**
 * JOLT-Atlas prover for generating zkML proofs
 *
 * @example
 * ```typescript
 * const prover = new JoltAtlas(modelBytes);
 * const proof = await prover.prove(inputData);
 * ```
 */
export class JoltAtlas {
  private modelBytes: Buffer;
  private commitment: ModelCommitment;

  /**
   * Create a new prover from model bytes
   */
  constructor(modelBytes: Buffer | Uint8Array) {
    this.modelBytes = Buffer.from(modelBytes);
    this.commitment = CommitmentGenerator.fromBytes(this.modelBytes);
  }

  /**
   * Create prover with pre-computed commitment
   */
  static withCommitment(
    modelBytes: Buffer | Uint8Array,
    commitment: ModelCommitment
  ): JoltAtlas {
    const prover = new JoltAtlas(modelBytes);

    // Verify commitment matches
    if (prover.commitment.commitment !== commitment.commitment) {
      throw new Error(
        `Commitment mismatch: expected ${commitment.commitment}, got ${prover.commitment.commitment}`
      );
    }

    prover.commitment = commitment;
    return prover;
  }

  /**
   * Get the model commitment
   */
  getCommitment(): ModelCommitment {
    return this.commitment;
  }

  /**
   * Generate a zkML proof for the given input
   */
  async prove(
    input: Buffer | Uint8Array | string,
    config: Partial<ProofConfig> = {}
  ): Promise<JoltAtlasProof> {
    const fullConfig: ProofConfig = { ...DEFAULT_PROOF_CONFIG, ...config };
    const inputBytes = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input);

    // Generate input commitment
    const inputCommitment = createInputCommitment(inputBytes);

    // Execute inference
    const inferenceOutput = await this.executeInference(inputBytes);

    // Generate output commitment
    const outputCommitmentData = createOutputCommitment(inferenceOutput);
    const outputCommitment: OutputCommitment = {
      hash: outputCommitmentData.hash,
      decisionType: inferenceOutput.decisionType,
    };

    // Generate execution proof
    const executionProof = fullConfig.zeroKnowledge
      ? await this.generateZkProof(inputBytes, inferenceOutput)
      : await this.generateTransparentProof(inputBytes, inferenceOutput);

    return {
      modelCommitment: this.commitment,
      inputCommitment,
      outputCommitment,
      executionProof: Buffer.from(executionProof).toString('base64'),
      timestamp: currentTimestamp(),
      version: PROOF_VERSION,
    };
  }

  /**
   * Generate proofs for multiple inputs
   */
  async proveBatch(
    inputs: Array<Buffer | Uint8Array | string>,
    config: Partial<ProofConfig> = {}
  ): Promise<JoltAtlasProof[]> {
    return Promise.all(inputs.map((input) => this.prove(input, config)));
  }

  /**
   * Execute model inference (simulated)
   *
   * ⚠️ WARNING: This is a MOCK implementation that returns deterministic fake outputs.
   * It does NOT run actual model inference.
   *
   * For production, integrate with ONNX.js, TensorFlow.js, or similar.
   */
  private async executeInference(input: Buffer): Promise<InferenceOutput> {
    // Show warning once
    if (!mockWarningShown && !SUPPRESS_MOCK_WARNING) {
      mockWarningShown = true;
      console.warn(
        '[ZKML WARNING] Using MOCK inference implementation. ' +
        'This generates FAKE proofs and is NOT suitable for production. ' +
        'Set ZKML_MOCK_WARNING=false to suppress this warning.'
      );
    }

    const combined = Buffer.concat([this.modelBytes, input]);
    const resultHash = keccak256(combined);

    // Deterministic decision based on hash
    const firstByte = parseInt(resultHash.slice(0, 2), 16);
    const decisionType = [
      DecisionType.Approve,
      DecisionType.Deny,
      DecisionType.Escalate,
      DecisionType.Defer,
    ][firstByte % 4];

    const secondByte = parseInt(resultHash.slice(2, 4), 16);
    const confidence = secondByte / 255;

    return {
      decisionType,
      confidence,
      rawOutput: Array.from(Buffer.from(resultHash, 'hex')).map((b) => b / 255),
    };
  }

  /**
   * Generate zero-knowledge proof
   *
   * ⚠️ WARNING: This is a MOCK implementation that creates fake proof structures.
   * It does NOT generate real cryptographic proofs.
   *
   * These proofs can be trivially forged and provide NO security guarantees.
   */
  private async generateZkProof(
    input: Buffer,
    output: InferenceOutput
  ): Promise<Buffer> {
    // WARNING: MOCK IMPLEMENTATION
    // Real implementation would use JOLT/HyperNova for actual ZK proofs

    const header = Buffer.from('JOLT-ATLAS-ZK-V1');
    const securityLevel = Buffer.alloc(4);
    securityLevel.writeUInt32LE(128);

    const traceCommitment = Buffer.from(
      keccak256(Buffer.concat([input, Buffer.from(JSON.stringify(output))])),
      'hex'
    );

    // Simulated proof components
    const commitment = Buffer.alloc(128);
    const response = Buffer.alloc(256);
    const auxiliary = Buffer.alloc(64);

    // Random-looking data for simulation
    const timestamp = Buffer.alloc(8);
    timestamp.writeBigInt64LE(BigInt(Date.now()));

    return Buffer.concat([
      header,
      securityLevel,
      traceCommitment,
      commitment,
      response,
      auxiliary,
      timestamp,
    ]);
  }

  /**
   * Generate transparent (non-ZK) proof
   */
  private async generateTransparentProof(
    input: Buffer,
    output: InferenceOutput
  ): Promise<Buffer> {
    const header = Buffer.from('JOLT-ATLAS-TP-V1');

    const trace = Buffer.from(JSON.stringify({
      input: input.toString('hex'),
      output,
    }));

    const length = Buffer.alloc(4);
    length.writeUInt32LE(trace.length);

    return Buffer.concat([header, length, trace]);
  }
}

/**
 * Encode proof for HTTP header
 */
export function encodeProofForHeader(proof: JoltAtlasProof): string {
  return Buffer.from(JSON.stringify(proof)).toString('base64');
}

/**
 * Decode proof from HTTP header
 */
export function decodeProofFromHeader(encoded: string): JoltAtlasProof {
  return JSON.parse(Buffer.from(encoded, 'base64').toString());
}
