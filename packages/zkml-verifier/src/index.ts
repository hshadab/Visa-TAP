/**
 * @icme/zkml-verifier
 *
 * Lightweight JOLT-Atlas zkML verifier for merchants.
 * This package provides only verification capabilities, without proof generation.
 *
 * @example
 * ```typescript
 * import { JoltAtlasVerifier } from '@icme/zkml-verifier';
 *
 * const verifier = new JoltAtlasVerifier();
 * const result = await verifier.verify({
 *   proof: proofBytes,
 *   modelCommitment: commitment,
 * });
 * ```
 */

// Re-export verifier and types from main package
export {
  JoltAtlasVerifier,
  VerificationResult,
  VerifierConfig,
  RegisteredModel,
  JoltAtlasProof,
  ModelCommitment,
  InputCommitment,
  OutputCommitment,
  DecisionType,
  DEFAULT_VERIFIER_CONFIG,
} from '@icme/jolt-atlas';

// Additional exports for merchant convenience

export interface VerifyParams {
  /** Base64-encoded or decoded proof */
  proof: string | Buffer;
  /** Hex-encoded model commitment */
  modelCommitment: string;
  /** Optional registered models map */
  registeredModels?: Map<string, import('@icme/jolt-atlas').RegisteredModel>;
}

export interface QuickVerifyResult {
  valid: boolean;
  modelCommitment?: string;
  error?: string;
}

/**
 * Quick verification helper for simple use cases
 */
export async function quickVerify(params: VerifyParams): Promise<QuickVerifyResult> {
  const { JoltAtlasVerifier } = await import('@icme/jolt-atlas');

  const verifier = new JoltAtlasVerifier({
    requireRegisteredModel: false,
    enableCache: false,
  });

  // Decode proof if needed
  let proof: import('@icme/jolt-atlas').JoltAtlasProof;
  try {
    const proofData =
      typeof params.proof === 'string'
        ? params.proof
        : params.proof.toString('base64');

    // Try to parse as JSON first (direct proof object)
    try {
      proof = JSON.parse(
        Buffer.from(proofData, 'base64').toString()
      );
    } catch {
      // Try parsing as-is
      proof = JSON.parse(proofData);
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to decode proof: ${error}`,
    };
  }

  const result = await verifier.verify(proof);

  return {
    valid: result.valid,
    modelCommitment: result.modelCommitment,
    error: result.error,
  };
}

/**
 * Verify proof via NovaNet facilitator
 */
export async function verifyViaFacilitator(
  proof: string,
  modelCommitment: string,
  facilitatorUrl: string = 'https://verify.novanet.xyz/v1/zkml/verify'
): Promise<QuickVerifyResult> {
  try {
    const response = await fetch(facilitatorUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof,
        model_commitment: modelCommitment,
      }),
    });

    const result = await response.json();

    return {
      valid: result.valid,
      modelCommitment: result.model_commitment,
      error: result.error,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Facilitator request failed: ${error}`,
    };
  }
}
