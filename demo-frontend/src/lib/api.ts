/**
 * API client for JOLT-Atlas verification service
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface VerifyRequest {
  proof: string;
  model_commitment: string;
  tap_signature?: string;
  transaction_amount?: number;
}

export interface VerifyResponse {
  valid: boolean;
  model_commitment?: string;
  verified_at?: number;
  model_info?: {
    agentId: string;
    registeredAt: number;
    version: string;
    name?: string;
  };
  error?: string;
  error_code?: string;
}

export interface ModelInfo {
  agentId: string;
  registeredAt: number;
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
 * Verify a zkML proof
 */
export async function verifyProof(request: VerifyRequest): Promise<VerifyResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/zkml/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return response.json();
}

/**
 * Get model information
 */
export async function getModelInfo(commitment: string): Promise<ModelInfo | null> {
  const response = await fetch(`${API_BASE_URL}/v1/zkml/models/${commitment}`);

  if (response.status === 404) {
    return null;
  }

  return response.json();
}

/**
 * Get verification statistics
 */
export async function getStats(): Promise<VerificationStats> {
  const response = await fetch(`${API_BASE_URL}/v1/zkml/stats`);
  return response.json();
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}
