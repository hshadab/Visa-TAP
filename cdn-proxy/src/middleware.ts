/**
 * Express middleware for zkML verification
 */

import { Request, Response, NextFunction } from 'express';
import { verifyZkmlProof, ZkmlVerificationResult } from './verify';
import { ZkmlProxyConfig, loadConfig } from './config';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      zkmlVerification?: ZkmlVerificationResult;
    }
  }
}

/**
 * Middleware options
 */
export interface ZkmlMiddlewareOptions {
  /** USD threshold for requiring proof */
  threshold?: number;

  /** Verification mode */
  verifyMode?: 'local' | 'facilitator';

  /** Facilitator URL */
  facilitatorUrl?: string;

  /** Block on missing proofs */
  blockMissingProofs?: boolean;

  /** Block on invalid proofs */
  blockInvalidProofs?: boolean;

  /** Function to extract transaction amount from request */
  getTransactionAmount?: (req: Request) => number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default amount extractor - looks for amount in body or query
 */
function defaultGetAmount(req: Request): number {
  // Try body first
  if (req.body?.amount) {
    return typeof req.body.amount === 'number'
      ? req.body.amount
      : parseFloat(req.body.amount);
  }

  // Try query params
  if (req.query?.amount) {
    return parseFloat(req.query.amount as string);
  }

  // Default to 0 (no proof required)
  return 0;
}

/**
 * Create zkML verification middleware
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { zkmlMiddleware } from '@visa-tap/cdn-proxy-zkml';
 *
 * const app = express();
 *
 * app.use('/api/payment', zkmlMiddleware({
 *   threshold: 1000,
 *   verifyMode: 'local',
 * }));
 *
 * app.post('/api/payment', (req, res) => {
 *   console.log('zkML result:', req.zkmlVerification);
 *   // Process payment...
 * });
 * ```
 */
export function zkmlMiddleware(
  options: ZkmlMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const config = loadConfig();
  const mergedOptions: ZkmlMiddlewareOptions = {
    threshold: config.threshold,
    verifyMode: config.verifyMode,
    facilitatorUrl: config.facilitatorUrl,
    blockMissingProofs: config.blockMissingProofs,
    blockInvalidProofs: config.blockInvalidProofs,
    debug: config.debug,
    ...options,
  };

  const getAmount = options.getTransactionAmount || defaultGetAmount;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract transaction amount
      const amount = getAmount(req);

      if (mergedOptions.debug) {
        console.log(`[zkML] Verifying request: amount=$${amount}`);
      }

      // Convert headers to simple object
      const headers: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
      }

      // Verify zkML proof
      const result = await verifyZkmlProof(headers, amount, {
        threshold: mergedOptions.threshold,
        verifyMode: mergedOptions.verifyMode,
        facilitatorUrl: mergedOptions.facilitatorUrl,
        blockMissingProofs: mergedOptions.blockMissingProofs,
        blockInvalidProofs: mergedOptions.blockInvalidProofs,
        debug: mergedOptions.debug,
      });

      // Attach result to request
      req.zkmlVerification = result;

      if (mergedOptions.debug) {
        console.log(`[zkML] Verification result:`, result);
      }

      // Handle blocking
      if (result.zkml === 'missing' && mergedOptions.blockMissingProofs) {
        res.status(403).json({
          error: 'zkML proof required',
          details: result.error,
          code: 'ZKML_PROOF_MISSING',
        });
        return;
      }

      if (result.zkml === 'failed' && mergedOptions.blockInvalidProofs) {
        res.status(403).json({
          error: 'zkML verification failed',
          details: result.error,
          code: 'ZKML_VERIFICATION_FAILED',
        });
        return;
      }

      next();
    } catch (error) {
      if (mergedOptions.debug) {
        console.error('[zkML] Middleware error:', error);
      }

      // On error, fail open or closed based on config
      if (mergedOptions.blockInvalidProofs) {
        res.status(500).json({
          error: 'zkML verification error',
          code: 'ZKML_INTERNAL_ERROR',
        });
        return;
      }

      next();
    }
  };
}

/**
 * Simple verification check - returns true if zkML verification passed or wasn't required
 */
export function isZkmlVerified(req: Request): boolean {
  const result = req.zkmlVerification;
  return !result || result.zkml === 'verified' || result.zkml === 'not_required';
}

/**
 * Get zkML model commitment from verified request
 */
export function getVerifiedModelCommitment(req: Request): string | undefined {
  return req.zkmlVerification?.modelCommitment;
}
