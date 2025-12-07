/**
 * Model commitment generation
 */

import { keccak256 } from 'js-sha3';
import { ModelCommitment, currentTimestamp } from './types';

/**
 * Generates model commitments from various model formats
 */
export class CommitmentGenerator {
  /**
   * Generate commitment from model bytes
   */
  static fromBytes(
    modelBytes: Buffer | Uint8Array,
    version: string = '1.0.0'
  ): ModelCommitment {
    // Parse model into weights and architecture
    const { weights, architecture } = this.parseModelBytes(modelBytes);

    return this.fromComponents(weights, architecture, version);
  }

  /**
   * Generate commitment from raw components
   */
  static fromComponents(
    weights: Buffer | Uint8Array,
    architecture: Buffer | Uint8Array,
    version: string
  ): ModelCommitment {
    const weightsHash = keccak256(weights);
    const architectureHash = keccak256(architecture);

    // Combine hashes
    const combined = Buffer.concat([
      Buffer.from(weightsHash, 'hex'),
      Buffer.from(architectureHash, 'hex'),
    ]);
    const commitment = keccak256(combined);

    return {
      weightsHash,
      architectureHash,
      commitment,
      version,
      createdAt: currentTimestamp(),
    };
  }

  /**
   * Generate commitment from JSON representation
   */
  static fromJson(json: string): ModelCommitment {
    const parsed = JSON.parse(json);
    return {
      weightsHash: parsed.weightsHash || parsed.weights_hash,
      architectureHash: parsed.architectureHash || parsed.architecture_hash,
      commitment: parsed.commitment,
      version: parsed.version,
      createdAt: parsed.createdAt || parsed.created_at,
    };
  }

  /**
   * Verify that model bytes match a commitment
   */
  static verify(
    modelBytes: Buffer | Uint8Array,
    expected: ModelCommitment
  ): boolean {
    const computed = this.fromBytes(modelBytes, expected.version);
    return computed.commitment === expected.commitment;
  }

  /**
   * Parse model bytes into weights and architecture
   * (Simplified implementation)
   */
  private static parseModelBytes(modelBytes: Buffer | Uint8Array): {
    weights: Buffer;
    architecture: Buffer;
  } {
    const bytes = Buffer.from(modelBytes);

    // Simplified parsing - in production would parse ONNX/TF/PyTorch properly
    const mid = Math.floor(bytes.length / 2);

    return {
      architecture: bytes.slice(0, Math.min(mid, 1024)),
      weights: bytes.slice(mid),
    };
  }
}

/**
 * Create input commitment from data
 */
export function createInputCommitment(
  data: Buffer | Uint8Array | string
): { hash: string; schemaVersion: number } {
  const bytes = typeof data === 'string' ? Buffer.from(data) : data;
  const hash = keccak256(bytes);

  return {
    hash,
    schemaVersion: 1,
  };
}

/**
 * Create output commitment from inference result
 */
export function createOutputCommitment(
  output: object
): { hash: string } {
  const json = JSON.stringify(output);
  const hash = keccak256(Buffer.from(json));

  return { hash };
}
