/**
 * zkML verification service
 */

import {
  JoltAtlasVerifier,
  JoltAtlasProof,
  RegisteredModel,
  currentTimestamp,
} from '@icme/jolt-atlas';

export interface VerifyResult {
  valid: boolean;
  modelCommitment?: string;
  verifiedAt?: number;
  modelInfo?: ModelInfo;
  error?: string;
  errorCode?: string;
}

export interface ModelInfo {
  agentId: string;
  registeredAt: number;
  version: string;
  name?: string;
}

export interface RegisterModelParams {
  commitment: string;
  agentId: string;
  version: string;
  name?: string;
}

export interface VerificationStats {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  registeredModels: number;
  uptime: number;
}

/**
 * zkML verification service
 */
export class ZkmlVerificationService {
  private verifier: JoltAtlasVerifier;
  private models: Map<string, RegisteredModel>;
  private stats: {
    total: number;
    success: number;
    failed: number;
    startTime: number;
  };

  constructor() {
    this.verifier = new JoltAtlasVerifier({
      requireRegisteredModel: false, // We'll check manually
      enableCache: true,
      cacheTtl: 60,
    });

    this.models = new Map();
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      startTime: Date.now(),
    };
  }

  /**
   * Verify a zkML proof
   */
  async verifyProof(proofBase64: string, modelCommitment: string): Promise<VerifyResult> {
    this.stats.total++;

    try {
      // Decode proof
      let proof: JoltAtlasProof;
      try {
        const proofJson = Buffer.from(proofBase64, 'base64').toString();
        proof = JSON.parse(proofJson);
      } catch {
        this.stats.failed++;
        return {
          valid: false,
          error: 'Invalid proof encoding',
          errorCode: 'INVALID_PROOF_FORMAT',
        };
      }

      // Verify commitment matches
      if (proof.modelCommitment.commitment !== modelCommitment) {
        this.stats.failed++;
        return {
          valid: false,
          error: 'Proof commitment does not match provided commitment',
          errorCode: 'COMMITMENT_MISMATCH',
        };
      }

      // Verify proof
      const result = await this.verifier.verify(proof);

      if (result.valid) {
        this.stats.success++;

        // Get model info if registered
        const modelInfo = this.models.get(modelCommitment);

        return {
          valid: true,
          modelCommitment: result.modelCommitment,
          verifiedAt: result.verifiedAt,
          modelInfo: modelInfo
            ? {
                agentId: modelInfo.agentId,
                registeredAt: modelInfo.registeredAt,
                version: modelInfo.version,
                name: modelInfo.name,
              }
            : undefined,
        };
      } else {
        this.stats.failed++;
        return {
          valid: false,
          error: result.error,
          errorCode: this.mapErrorCode(result.error),
        };
      }
    } catch (error) {
      this.stats.failed++;
      console.error('Verification error:', error);
      return {
        valid: false,
        error: 'Internal verification error',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(commitment: string): Promise<ModelInfo | null> {
    const model = this.models.get(commitment);
    if (!model) return null;

    return {
      agentId: model.agentId,
      registeredAt: model.registeredAt,
      version: model.version,
      name: model.name,
    };
  }

  /**
   * Register a new model
   */
  async registerModel(params: RegisterModelParams): Promise<RegisteredModel> {
    const model: RegisteredModel = {
      commitment: params.commitment,
      agentId: params.agentId,
      registeredAt: currentTimestamp(),
      version: params.version,
      name: params.name,
      active: true,
    };

    this.models.set(params.commitment, model);
    this.verifier.addRegisteredModel(model);

    return model;
  }

  /**
   * Validate API key (placeholder implementation)
   */
  validateApiKey(apiKey: string): boolean {
    // In production, this would validate against a real API key store
    // For now, accept any key that looks valid
    return apiKey.length >= 32;
  }

  /**
   * Get verification statistics
   */
  getStats(): VerificationStats {
    return {
      totalVerifications: this.stats.total,
      successfulVerifications: this.stats.success,
      failedVerifications: this.stats.failed,
      registeredModels: this.models.size,
      uptime: Math.floor((Date.now() - this.stats.startTime) / 1000),
    };
  }

  /**
   * Map error message to error code
   */
  private mapErrorCode(error?: string): string {
    if (!error) return 'UNKNOWN_ERROR';

    if (error.includes('expired')) return 'PROOF_EXPIRED';
    if (error.includes('not registered')) return 'MODEL_NOT_REGISTERED';
    if (error.includes('mismatch')) return 'COMMITMENT_MISMATCH';
    if (error.includes('invalid')) return 'JOLT_VERIFICATION_FAILED';

    return 'VERIFICATION_FAILED';
  }
}
