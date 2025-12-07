/**
 * Core types for JOLT-Atlas zkML proofs
 */

/**
 * Model commitment - cryptographic binding to a specific model version
 */
export interface ModelCommitment {
  /** Hex-encoded Keccak256 hash of model weights */
  weightsHash: string;
  /** Hex-encoded Keccak256 hash of model architecture */
  architectureHash: string;
  /** Hex-encoded combined commitment hash */
  commitment: string;
  /** Model version identifier */
  version: string;
  /** Unix timestamp when commitment was generated */
  createdAt: number;
}

/**
 * Input commitment - privacy-preserving hash of transaction context
 */
export interface InputCommitment {
  /** Hex-encoded Keccak256 hash of input data */
  hash: string;
  /** Input schema version */
  schemaVersion: number;
}

/**
 * Output commitment - hash of model decision
 */
export interface OutputCommitment {
  /** Hex-encoded hash of output */
  hash: string;
  /** Type of decision made */
  decisionType: DecisionType;
}

/**
 * Decision types for agent transactions
 */
export enum DecisionType {
  Approve = 'approve',
  Deny = 'deny',
  Escalate = 'escalate',
  Defer = 'defer',
}

/**
 * Inference output from model
 */
export interface InferenceOutput {
  /** Decision type */
  decisionType: DecisionType;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Optional reason code */
  reasonCode?: string;
  /** Raw model output */
  rawOutput?: number[];
}

/**
 * Complete JOLT-Atlas proof structure
 */
export interface JoltAtlasProof {
  /** Model commitment binding proof to model version */
  modelCommitment: ModelCommitment;
  /** Input commitment (privacy-preserving) */
  inputCommitment: InputCommitment;
  /** Output commitment */
  outputCommitment: OutputCommitment;
  /** Base64-encoded execution proof */
  executionProof: string;
  /** Proof generation timestamp */
  timestamp: number;
  /** Proof format version */
  version: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether the proof is valid */
  valid: boolean;
  /** Hex-encoded model commitment */
  modelCommitment: string;
  /** Timestamp of verification */
  verifiedAt: number;
  /** Error message if invalid */
  error?: string;
}

/**
 * Registered model information
 */
export interface RegisteredModel {
  /** Hex-encoded commitment */
  commitment: string;
  /** Agent identifier */
  agentId: string;
  /** Registration timestamp */
  registeredAt: number;
  /** Model version */
  version: string;
  /** Model name/description */
  name?: string;
  /** Whether model is active */
  active: boolean;
}

/**
 * Proof configuration options
 */
export interface ProofConfig {
  /** Enable zero-knowledge mode */
  zeroKnowledge: boolean;
  /** Pre-registered model commitment */
  modelCommitment?: ModelCommitment;
  /** Transaction threshold (USD) */
  threshold?: number;
  /** Custom proving parameters */
  provingParams?: ProvingParams;
}

/**
 * Proving parameters
 */
export interface ProvingParams {
  /** Security level in bits */
  securityLevel: number;
  /** Enable HyperNova folding */
  useHypernova: boolean;
  /** Maximum proof size in bytes */
  maxProofSize?: number;
}

/**
 * Verifier configuration
 */
export interface VerifierConfig {
  /** Require model to be in registry */
  requireRegisteredModel: boolean;
  /** Maximum proof age in seconds */
  maxProofAge: number;
  /** Registry URL for model lookup */
  registryUrl?: string;
  /** Enable strict mode */
  strictMode: boolean;
  /** Enable verification caching */
  enableCache: boolean;
  /** Cache TTL in seconds */
  cacheTtl: number;
}

/**
 * Default proof configuration
 */
export const DEFAULT_PROOF_CONFIG: ProofConfig = {
  zeroKnowledge: true,
  threshold: 1000,
};

/**
 * Default verifier configuration
 */
export const DEFAULT_VERIFIER_CONFIG: VerifierConfig = {
  requireRegisteredModel: true,
  maxProofAge: 300,
  strictMode: false,
  enableCache: true,
  cacheTtl: 60,
};

/**
 * Get current Unix timestamp
 */
export function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
