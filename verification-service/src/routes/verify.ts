/**
 * Verification routes for zkML proofs
 */

import { Router, Request, Response } from 'express';
import { ZkmlVerificationService } from '../services/zkml';

const router = Router();
const zkmlService = new ZkmlVerificationService();

/**
 * POST /v1/zkml/verify
 *
 * Verify a zkML proof
 *
 * Request body:
 * {
 *   "proof": "<base64_encoded_proof>",
 *   "model_commitment": "<hex_commitment>",
 *   "tap_signature": "<tap_sig>",  // optional
 *   "transaction_amount": 15000    // optional
 * }
 *
 * Response:
 * {
 *   "valid": true,
 *   "model_commitment": "<hex_commitment>",
 *   "verified_at": 1733600000,
 *   "model_info": { ... }  // if registered
 * }
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { proof, model_commitment, tap_signature, transaction_amount } = req.body;

    // Validate required fields
    if (!proof) {
      return res.status(400).json({
        valid: false,
        error: 'Missing required field: proof',
        error_code: 'INVALID_REQUEST',
      });
    }

    if (!model_commitment) {
      return res.status(400).json({
        valid: false,
        error: 'Missing required field: model_commitment',
        error_code: 'INVALID_REQUEST',
      });
    }

    // Verify proof
    const result = await zkmlService.verifyProof(proof, model_commitment);

    if (result.valid) {
      res.json({
        valid: true,
        model_commitment: result.modelCommitment,
        verified_at: result.verifiedAt,
        model_info: result.modelInfo,
      });
    } else {
      res.json({
        valid: false,
        error: result.error,
        error_code: result.errorCode,
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      valid: false,
      error: 'Verification failed',
      error_code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /v1/zkml/models/:commitment
 *
 * Get information about a registered model
 */
router.get('/models/:commitment', async (req: Request, res: Response) => {
  try {
    const { commitment } = req.params;

    const modelInfo = await zkmlService.getModelInfo(commitment);

    if (modelInfo) {
      res.json(modelInfo);
    } else {
      res.status(404).json({
        error: 'Model not found',
        error_code: 'MODEL_NOT_FOUND',
      });
    }
  } catch (error) {
    console.error('Model lookup error:', error);
    res.status(500).json({
      error: 'Lookup failed',
      error_code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /v1/zkml/models
 *
 * Register a new model (requires API key)
 */
router.post('/models', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        error_code: 'UNAUTHORIZED',
      });
    }

    // Validate API key
    try {
      if (!zkmlService.validateApiKey(apiKey)) {
        return res.status(403).json({
          error: 'Invalid API key',
          error_code: 'FORBIDDEN',
        });
      }
    } catch (error) {
      // API key validation not configured for production
      console.error('API key validation error:', error);
      return res.status(503).json({
        error: 'API key validation service not configured',
        error_code: 'SERVICE_UNAVAILABLE',
      });
    }

    const { commitment, agent_id, version, name } = req.body;

    if (!commitment || !agent_id) {
      return res.status(400).json({
        error: 'Missing required fields: commitment, agent_id',
        error_code: 'INVALID_REQUEST',
      });
    }

    const result = await zkmlService.registerModel({
      commitment,
      agentId: agent_id,
      version: version || '1.0.0',
      name,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      error_code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /v1/zkml/stats
 *
 * Get verification statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  const stats = zkmlService.getStats();
  res.json(stats);
});

export default router;
