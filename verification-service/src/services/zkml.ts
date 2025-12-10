/**
 * zkML verification service
 */

import {
  JoltAtlasVerifier,
  JoltAtlasProof,
  RegisteredModel,
  currentTimestamp,
} from '@icme/jolt-atlas';

/**
 * Environment configuration
 */
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

/**
 * API key configuration
 * In production, API_KEYS should be set via environment variable as a comma-separated list
 * Example: API_KEYS="key1,key2,key3"
 */
const CONFIGURED_API_KEYS = process.env.API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || [];
const ALLOW_INSECURE_API_VALIDATION = process.env.ALLOW_INSECURE_API_VALIDATION === 'true';

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
   * Validate API key
   *
   * In production mode:
   * - Requires API_KEYS environment variable to be set
   * - Validates against the configured list of API keys
   *
   * In development mode:
   * - Accepts any key >= 32 characters (unless ALLOW_INSECURE_API_VALIDATION=true in production)
   *
   * @throws Error if production mode and no API keys are configured
   */
  validateApiKey(apiKey: string): boolean {
    // Basic length check
    if (!apiKey || apiKey.length < 32) {
      return false;
    }

    // If we have configured API keys, always use them
    if (CONFIGURED_API_KEYS.length > 0) {
      return CONFIGURED_API_KEYS.includes(apiKey);
    }

    // Production safety check
    if (IS_PRODUCTION && !ALLOW_INSECURE_API_VALIDATION) {
      console.error(
        '[SECURITY] API key validation attempted in production without configured API_KEYS. ' +
        'Set API_KEYS environment variable with valid keys, or set ALLOW_INSECURE_API_VALIDATION=true to bypass (NOT RECOMMENDED).'
      );
      throw new Error('API key validation not configured for production');
    }

    // Development mode: warn and accept any key >= 32 characters
    if (!IS_PRODUCTION) {
      console.warn(
        '[DEV WARNING] Using insecure API key validation. ' +
        'Set API_KEYS environment variable for secure validation.'
      );
    }

    return true;
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
