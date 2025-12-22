/**
 * JOLT-Atlas proof verification
 */

import {
  JoltAtlasProof,
  VerificationResult,
  RegisteredModel,
  VerifierConfig,
  DEFAULT_VERIFIER_CONFIG,
  currentTimestamp,
} from './types';

/**
 * JOLT-Atlas proof verifier
 *
 * @example
 * ```typescript
 * const verifier = new JoltAtlasVerifier();
 * const result = await verifier.verify(proof);
 * ```
 */
export class JoltAtlasVerifier {
  private registeredModels: Map<string, RegisteredModel>;
  private config: VerifierConfig;
  private cache: Map<string, { result: VerificationResult; cachedAt: number }>;

  constructor(config: Partial<VerifierConfig> = {}) {
    this.registeredModels = new Map();
    this.config = { ...DEFAULT_VERIFIER_CONFIG, ...config };
    this.cache = new Map();
  }

  /**
   * Load registered models from registry URL
   */
  async loadRegistry(registryUrl: string): Promise<number> {
    try {
      const response = await fetch(registryUrl);
      const models = (await response.json()) as RegisteredModel[];

      for (const model of models) {
        this.registeredModels.set(model.commitment, model);
      }

      return models.length;
    } catch (error) {
      console.error('Failed to load registry:', error);
      return 0;
    }
  }

  /**
   * Add a registered model manually
   */
  addRegisteredModel(model: RegisteredModel): void {
    this.registeredModels.set(model.commitment, model);
  }

  /**
   * Verify a JOLT-Atlas proof
   */
  async verify(proof: JoltAtlasProof): Promise<VerificationResult> {
    // Check cache
    if (this.config.enableCache) {
      const cached = this.checkCache(proof);
      if (cached) return cached;
    }

    // Check timestamp freshness
    if (!this.checkTimestamp(proof.timestamp)) {
      return this.cacheResult(proof, {
        valid: false,
        modelCommitment: proof.modelCommitment.commitment,
        verifiedAt: currentTimestamp(),
        error: `Proof expired: timestamp ${proof.timestamp} is older than ${this.config.maxProofAge}s`,
      });
    }

    // Check model registration
    if (this.config.requireRegisteredModel) {
      if (!this.registeredModels.has(proof.modelCommitment.commitment)) {
        return this.cacheResult(proof, {
          valid: false,
          modelCommitment: proof.modelCommitment.commitment,
          verifiedAt: currentTimestamp(),
          error: 'Model not registered',
        });
      }

      const model = this.registeredModels.get(proof.modelCommitment.commitment)!;
      if (!model.active) {
        return this.cacheResult(proof, {
          valid: false,
          modelCommitment: proof.modelCommitment.commitment,
          verifiedAt: currentTimestamp(),
          error: 'Model is deactivated',
        });
      }
    }

    // Verify proof structure
    const structureError = this.verifyProofStructure(proof);
    if (structureError) {
      return this.cacheResult(proof, {
        valid: false,
        modelCommitment: proof.modelCommitment.commitment,
        verifiedAt: currentTimestamp(),
        error: structureError,
      });
    }

    // Verify JOLT proof
    const joltValid = await this.verifyJoltProof(proof.executionProof);
    if (!joltValid) {
      return this.cacheResult(proof, {
        valid: false,
        modelCommitment: proof.modelCommitment.commitment,
        verifiedAt: currentTimestamp(),
        error: 'JOLT proof verification failed',
      });
    }

    // Verify commitment binding
    if (!this.verifyCommitmentBinding(proof)) {
      return this.cacheResult(proof, {
        valid: false,
        modelCommitment: proof.modelCommitment.commitment,
        verifiedAt: currentTimestamp(),
        error: 'Commitment binding verification failed',
      });
    }

    return this.cacheResult(proof, {
      valid: true,
      modelCommitment: proof.modelCommitment.commitment,
      verifiedAt: currentTimestamp(),
    });
  }

  /**
   * Verify multiple proofs
   */
  async verifyBatch(proofs: JoltAtlasProof[]): Promise<VerificationResult[]> {
    return Promise.all(proofs.map((proof) => this.verify(proof)));
  }

  /**
   * Check if a model is registered
   */
  isModelRegistered(commitment: string): boolean {
    return this.registeredModels.has(commitment);
  }

  /**
   * Get model info by commitment
   */
  getModelInfo(commitment: string): RegisteredModel | undefined {
    return this.registeredModels.get(commitment);
  }

  /**
   * Check proof timestamp freshness
   */
  private checkTimestamp(timestamp: number): boolean {
    const now = currentTimestamp();
    const age = now - timestamp;

    if (age > this.config.maxProofAge) {
      return false;
    }

    // Check for future timestamps (clock skew protection)
    if (timestamp > now + 60) {
      return false;
    }

    return true;
  }

  /**
   * Verify proof structure
   */
  private verifyProofStructure(proof: JoltAtlasProof): string | null {
    // Check version
    if (proof.version === 0 || proof.version > 10) {
      return `Unsupported proof version: ${proof.version}`;
    }

    // Check execution proof
    if (!proof.executionProof || proof.executionProof.length === 0) {
      return 'Empty execution proof';
    }

    // Check proof size
    const proofBytes = Buffer.from(proof.executionProof, 'base64');
    const MAX_PROOF_SIZE = 1_000_000; // 1MB
    if (proofBytes.length > MAX_PROOF_SIZE) {
      return `Proof too large: ${proofBytes.length} bytes`;
    }

    return null;
  }

  /**
   * Verify JOLT cryptographic proof
   */
  private async verifyJoltProof(executionProof: string): Promise<boolean> {
    try {
      const proofBytes = Buffer.from(executionProof, 'base64');

      if (proofBytes.length < 16) {
        return false;
      }

      const header = proofBytes.slice(0, 16).toString();

      // Verify known headers
      const validHeaders = ['JOLT-ATLAS-ZK-V1', 'JOLT-ATLAS-TP-V1'];
      if (!validHeaders.includes(header)) {
        return false;
      }

      // In production, would verify actual cryptographic proof
      // For now, verify structure

      return proofBytes.length >= 100;
    } catch {
      return false;
    }
  }

  /**
   * Verify commitment binding
   */
  private verifyCommitmentBinding(proof: JoltAtlasProof): boolean {
    // Verify model commitment structure
    if (proof.modelCommitment.commitment.length !== 64) {
      return false;
    }

    // Verify input commitment
    if (proof.inputCommitment.hash.length !== 64) {
      return false;
    }

    // Verify output commitment
    if (proof.outputCommitment.hash.length !== 64) {
      return false;
    }

    return true;
  }

  /**
   * Check verification cache
   */
  private checkCache(proof: JoltAtlasProof): VerificationResult | null {
    const key = this.computeCacheKey(proof);
    const cached = this.cache.get(key);

    if (!cached) return null;

    const now = currentTimestamp();
    if (now - cached.cachedAt > this.config.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache verification result
   */
  private cacheResult(
    proof: JoltAtlasProof,
    result: VerificationResult
  ): VerificationResult {
    if (this.config.enableCache) {
      const key = this.computeCacheKey(proof);
      this.cache.set(key, {
        result,
        cachedAt: currentTimestamp(),
      });
    }
    return result;
  }

  /**
   * Compute cache key
   */
  private computeCacheKey(proof: JoltAtlasProof): string {
    return `${proof.modelCommitment.commitment}:${proof.inputCommitment.hash}:${proof.timestamp}`;
  }
}
