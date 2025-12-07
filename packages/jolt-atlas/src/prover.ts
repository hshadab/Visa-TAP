/**
 * JOLT-Atlas proof generation
 */

import { keccak256 } from 'js-sha3';
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
   */
  private async executeInference(input: Buffer): Promise<InferenceOutput> {
    // In production, this would run actual model inference
    // For now, we simulate with deterministic output

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
   */
  private async generateZkProof(
    input: Buffer,
    output: InferenceOutput
  ): Promise<Buffer> {
    // In production, this would use JOLT/HyperNova for real ZK proof
    // For now, we create a mock proof structure

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
