/**
 * @icme/jolt-atlas
 *
 * JOLT-Atlas zkML SDK for Visa TAP integration
 *
 * @example
 * ```typescript
 * import { JoltAtlas, ProofConfig } from '@icme/jolt-atlas';
 *
 * const prover = new JoltAtlas(modelPath);
 * const proof = await prover.prove(inputData, { zeroKnowledge: true });
 * ```
 */

export * from './types';
export * from './commitment';
export * from './prover';
export * from './verifier';

// Version info
export const VERSION = '0.1.0';
export const PROOF_VERSION = 1;
export const DEFAULT_THRESHOLD = 1000;
export const DEFAULT_MAX_PROOF_AGE = 300;
