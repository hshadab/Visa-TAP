/**
 * Configuration for zkML CDN proxy
 */

export interface ZkmlProxyConfig {
  /** USD threshold for requiring zkML proof (default: 1000) */
  threshold: number;

  /** Verification mode: 'local' or 'facilitator' */
  verifyMode: 'local' | 'facilitator';

  /** Facilitator URL for remote verification */
  facilitatorUrl: string;

  /** Whether to block requests with missing required proofs */
  blockMissingProofs: boolean;

  /** Whether to block requests with invalid proofs */
  blockInvalidProofs: boolean;

  /** Registry URL for model lookup */
  registryUrl?: string;

  /** Enable debug logging */
  debug: boolean;
}

export const DEFAULT_CONFIG: ZkmlProxyConfig = {
  threshold: 1000,
  verifyMode: 'local',
  facilitatorUrl: 'https://verify.novanet.xyz/v1/zkml/verify',
  blockMissingProofs: true,
  blockInvalidProofs: true,
  debug: false,
};

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ZkmlProxyConfig {
  return {
    threshold: parseInt(process.env.ZKML_THRESHOLD || '1000', 10),
    verifyMode: (process.env.ZKML_VERIFY_MODE as 'local' | 'facilitator') || 'local',
    facilitatorUrl:
      process.env.ZKML_FACILITATOR_URL || DEFAULT_CONFIG.facilitatorUrl,
    blockMissingProofs:
      process.env.ZKML_BLOCK_MISSING !== 'false',
    blockInvalidProofs:
      process.env.ZKML_BLOCK_INVALID !== 'false',
    registryUrl: process.env.ZKML_REGISTRY_URL,
    debug: process.env.ZKML_DEBUG === 'true',
  };
}
