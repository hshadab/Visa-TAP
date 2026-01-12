/**
 * Typed error classes for Spending Proofs
 */

export enum ErrorCode {
  // Prover errors
  PROVER_UNAVAILABLE = 'PROVER_UNAVAILABLE',
  PROVER_TIMEOUT = 'PROVER_TIMEOUT',
  PROVER_ERROR = 'PROVER_ERROR',
  PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
  PROOF_VERIFICATION_FAILED = 'PROOF_VERIFICATION_FAILED',

  // Input validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_PRICE = 'INVALID_PRICE',
  INVALID_BUDGET = 'INVALID_BUDGET',
  INVALID_RATE = 'INVALID_RATE',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Signature auth errors
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  SIGNATURE_EXPIRED = 'SIGNATURE_EXPIRED',
  ADDRESS_NOT_ALLOWED = 'ADDRESS_NOT_ALLOWED',

  // Contract errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  EXCEEDS_DAILY_LIMIT = 'EXCEEDS_DAILY_LIMIT',
  EXCEEDS_MAX_TRANSFER = 'EXCEEDS_MAX_TRANSFER',
  PROOF_ALREADY_USED = 'PROOF_ALREADY_USED',
  PROOF_EXPIRED = 'PROOF_EXPIRED',
  PROOF_NOT_ATTESTED = 'PROOF_NOT_ATTESTED',
  TX_INTENT_MISMATCH = 'TX_INTENT_MISMATCH',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',

  // Unknown
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Base error class for all Spending Proofs errors
 */
export class SpendingProofsError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'SpendingProofsError';
    this.code = details.code;
    this.cause = details.cause;
    this.context = details.context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
      context: this.context,
    };
  }
}

/**
 * Prover service errors
 */
export class ProverError extends SpendingProofsError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PROVER_ERROR,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super({ code, message, cause, context });
    this.name = 'ProverError';
  }

  static unavailable(cause?: unknown): ProverError {
    return new ProverError(
      'Prover service is unavailable. Please try again later.',
      ErrorCode.PROVER_UNAVAILABLE,
      cause
    );
  }

  static timeout(timeoutMs: number): ProverError {
    return new ProverError(
      `Proof generation timed out after ${timeoutMs}ms`,
      ErrorCode.PROVER_TIMEOUT,
      undefined,
      { timeoutMs }
    );
  }

  static generationFailed(reason: string, cause?: unknown): ProverError {
    return new ProverError(
      `Proof generation failed: ${reason}`,
      ErrorCode.PROOF_GENERATION_FAILED,
      cause
    );
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends SpendingProofsError {
  readonly field?: string;

  constructor(
    message: string,
    field?: string,
    code: ErrorCode = ErrorCode.INVALID_INPUT,
    context?: Record<string, unknown>
  ) {
    super({ code, message, context: { ...context, field } });
    this.name = 'ValidationError';
    this.field = field;
  }

  static invalidPrice(value: number): ValidationError {
    return new ValidationError(
      `Price must be non-negative, got ${value}`,
      'priceUsdc',
      ErrorCode.INVALID_PRICE,
      { value }
    );
  }

  static invalidBudget(value: number): ValidationError {
    return new ValidationError(
      `Budget must be non-negative, got ${value}`,
      'budgetUsdc',
      ErrorCode.INVALID_BUDGET,
      { value }
    );
  }

  static invalidRate(field: string, value: number): ValidationError {
    return new ValidationError(
      `${field} must be between 0 and 1, got ${value}`,
      field,
      ErrorCode.INVALID_RATE,
      { value }
    );
  }

  static missingField(field: string): ValidationError {
    return new ValidationError(
      `Missing required field: ${field}`,
      field,
      ErrorCode.MISSING_REQUIRED_FIELD
    );
  }

  static fromErrors(errors: string[]): ValidationError {
    return new ValidationError(
      `Validation failed: ${errors.join('; ')}`,
      undefined,
      ErrorCode.INVALID_INPUT,
      { errors }
    );
  }
}

/**
 * Parse error from unknown source into typed error
 */
export function parseError(error: unknown): SpendingProofsError {
  if (error instanceof SpendingProofsError) {
    return error;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('timeout') || msg.includes('timed out')) {
      return ProverError.timeout(0);
    }

    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return new SpendingProofsError({
        code: ErrorCode.NETWORK_ERROR,
        message: error.message,
        cause: error,
      });
    }

    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return new SpendingProofsError({
        code: ErrorCode.RATE_LIMITED,
        message: 'Rate limited. Please try again later.',
        cause: error,
      });
    }

    return new SpendingProofsError({
      code: ErrorCode.UNKNOWN,
      message: error.message,
      cause: error,
    });
  }

  return new SpendingProofsError({
    code: ErrorCode.UNKNOWN,
    message: String(error),
    cause: error,
  });
}
