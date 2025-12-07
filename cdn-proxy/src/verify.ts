/**
 * zkML proof verification for CDN proxy
 */

import { JoltAtlasVerifier, verifyViaFacilitator } from '@icme/zkml-verifier';
import { ZkmlProxyConfig, DEFAULT_CONFIG } from './config';

/**
 * Result of zkML verification
 */
export interface ZkmlVerificationResult {
  /** Verification status */
  zkml: 'verified' | 'not_required' | 'missing' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Verified model commitment */
  modelCommitment?: string;
  /** Verification mode used */
  mode?: 'local' | 'facilitator';
}

// Singleton verifier instance
let verifier: JoltAtlasVerifier | null = null;

/**
 * Get or create verifier instance
 */
function getVerifier(): JoltAtlasVerifier {
  if (!verifier) {
    verifier = new JoltAtlasVerifier({
      requireRegisteredModel: false,
      enableCache: true,
      cacheTtl: 60,
    });
  }
  return verifier;
}

/**
 * Extract zkML headers from request
 */
export interface ZkmlHeaders {
  proof?: string;
  modelCommitment?: string;
  threshold?: number;
  timestamp?: number;
}

export function extractZkmlHeaders(headers: Record<string, string | undefined>): ZkmlHeaders {
  return {
    proof: headers['x-zkml-proof'],
    modelCommitment: headers['x-zkml-model-commitment'],
    threshold: headers['x-zkml-threshold']
      ? parseInt(headers['x-zkml-threshold'], 10)
      : undefined,
    timestamp: headers['x-zkml-timestamp']
      ? parseInt(headers['x-zkml-timestamp'], 10)
      : undefined,
  };
}

/**
 * Verify zkML proof from HTTP request
 *
 * @param headers - Request headers object
 * @param transactionAmount - Transaction amount in USD
 * @param config - Optional configuration override
 */
export async function verifyZkmlProof(
  headers: Record<string, string | undefined>,
  transactionAmount: number,
  config: Partial<ZkmlProxyConfig> = {}
): Promise<ZkmlVerificationResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const threshold = fullConfig.threshold;

  // Check if proof is required based on threshold
  if (transactionAmount < threshold) {
    return { zkml: 'not_required' };
  }

  // Extract zkML headers
  const zkmlHeaders = extractZkmlHeaders(headers);

  // Proof required but missing
  if (!zkmlHeaders.proof || !zkmlHeaders.modelCommitment) {
    if (fullConfig.blockMissingProofs) {
      return {
        zkml: 'missing',
        error: `zkML proof required for transactions >= $${threshold}`,
      };
    }
    return { zkml: 'not_required' };
  }

  try {
    // Choose verification mode
    if (fullConfig.verifyMode === 'facilitator') {
      return await verifyViaFacilitatorMode(
        zkmlHeaders.proof,
        zkmlHeaders.modelCommitment,
        fullConfig.facilitatorUrl
      );
    } else {
      return await verifyLocalMode(zkmlHeaders.proof, zkmlHeaders.modelCommitment);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (fullConfig.debug) {
      console.error('[zkML] Verification error:', error);
    }

    if (fullConfig.blockInvalidProofs) {
      return {
        zkml: 'failed',
        error: `Verification error: ${errorMessage}`,
      };
    }

    return { zkml: 'not_required' };
  }
}

/**
 * Verify proof locally
 */
async function verifyLocalMode(
  proofBase64: string,
  modelCommitment: string
): Promise<ZkmlVerificationResult> {
  const verifier = getVerifier();

  // Decode proof
  let proof;
  try {
    const proofJson = Buffer.from(proofBase64, 'base64').toString();
    proof = JSON.parse(proofJson);
  } catch {
    return {
      zkml: 'failed',
      error: 'Invalid proof encoding',
      mode: 'local',
    };
  }

  // Verify
  const result = await verifier.verify(proof);

  if (result.valid) {
    return {
      zkml: 'verified',
      modelCommitment: result.modelCommitment,
      mode: 'local',
    };
  } else {
    return {
      zkml: 'failed',
      error: result.error || 'Verification failed',
      mode: 'local',
    };
  }
}

/**
 * Verify proof via facilitator
 */
async function verifyViaFacilitatorMode(
  proofBase64: string,
  modelCommitment: string,
  facilitatorUrl: string
): Promise<ZkmlVerificationResult> {
  const result = await verifyViaFacilitator(proofBase64, modelCommitment, facilitatorUrl);

  if (result.valid) {
    return {
      zkml: 'verified',
      modelCommitment: result.modelCommitment,
      mode: 'facilitator',
    };
  } else {
    return {
      zkml: 'failed',
      error: result.error || 'Facilitator verification failed',
      mode: 'facilitator',
    };
  }
}
