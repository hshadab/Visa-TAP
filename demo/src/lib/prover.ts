/**
 * JOLT-Atlas Prover Client
 *
 * Client for interacting with the JOLT-Atlas zkML prover service.
 */

import type { ProveResponse, VerifyResponse, HealthResponse } from './types';
import { PROVER_CONFIG } from './config';

/**
 * Check if the prover service is healthy
 */
export async function checkProverHealth(useLocal = false): Promise<HealthResponse> {
  const url = useLocal ? PROVER_CONFIG.localUrl : PROVER_CONFIG.url;

  try {
    const response = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(5000), // 5s timeout for health check
    });

    if (!response.ok) {
      throw new Error(`Prover health check failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.status,
      version: data.version,
      proofType: data.proof_type,
      modelsLoaded: data.models_loaded,
    };
  } catch (error) {
    throw new Error(`Prover unavailable at ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a zkML proof for spending model inputs
 */
export async function generateProof(
  inputs: number[],
  tag: string = 'visa-tap-demo'
): Promise<ProveResponse> {
  const url = PROVER_CONFIG.url;

  try {
    const response = await fetch(`${url}/prove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'spending-model',
        inputs,
        tag,
      }),
      signal: AbortSignal.timeout(PROVER_CONFIG.timeoutMs),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Prover error: ${response.status} - ${error}`,
        generationTimeMs: 0,
      };
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Proof generation failed',
        generationTimeMs: data.generation_time_ms || 0,
      };
    }

    return {
      success: true,
      proof: {
        proof: data.proof.proof,
        proofHash: data.proof.proof_hash,
        programIo: data.proof.program_io,
        metadata: {
          modelHash: data.proof.metadata.model_hash,
          inputHash: data.proof.metadata.input_hash,
          outputHash: data.proof.metadata.output_hash,
          proofSize: data.proof.metadata.proof_size,
          generationTime: data.proof.metadata.generation_time,
          proverVersion: data.proof.metadata.prover_version,
        },
        tag: data.proof.tag,
        timestamp: data.proof.timestamp,
      },
      inference: data.inference ? {
        output: data.inference.output,
        rawOutput: data.inference.raw_output,
        decision: data.inference.decision as 'approve' | 'reject',
        confidence: data.inference.confidence,
      } : undefined,
      generationTimeMs: data.generation_time_ms,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return {
        success: false,
        error: `Proof generation timed out after ${PROVER_CONFIG.timeoutMs}ms`,
        generationTimeMs: PROVER_CONFIG.timeoutMs,
      };
    }

    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      generationTimeMs: 0,
    };
  }
}

/**
 * Verify a SNARK proof cryptographically
 */
export async function verifyProof(
  proof: string,
  modelId: string,
  modelHash: string,
  programIo: string
): Promise<VerifyResponse> {
  const url = PROVER_CONFIG.url;

  try {
    const response = await fetch(`${url}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proof,
        model_id: modelId,
        model_hash: modelHash,
        program_io: programIo,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout for verification
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `Verify error: ${response.status}`,
        verificationTimeMs: 0,
      };
    }

    const data = await response.json();
    return {
      valid: data.valid,
      error: data.error,
      verificationTimeMs: data.verification_time_ms,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      verificationTimeMs: 0,
    };
  }
}

/**
 * Compute a simple hash of inputs (for display purposes)
 * Note: Real cryptographic hashing happens in the prover
 */
export function hashInputsSimple(inputs: number[]): string {
  // Simple hash for display - real hash computed by prover
  const str = inputs.map(n => n.toFixed(8)).join(',');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Format proof size for display
 */
export function formatProofSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

/**
 * Format generation time for display
 */
export function formatGenerationTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
