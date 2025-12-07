/**
 * CDN Proxy with zkML verification for Visa TAP
 *
 * This module provides Express middleware and utilities for verifying
 * zkML proofs in TAP payment requests.
 */

export { verifyZkmlProof, ZkmlVerificationResult } from './verify';
export { zkmlMiddleware, ZkmlMiddlewareOptions } from './middleware';
export { ZkmlProxyConfig, loadConfig } from './config';
