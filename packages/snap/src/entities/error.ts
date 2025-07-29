import type { Json } from '@metamask/utils';

export class BaseError extends Error {
  code: number;

  data?: Record<string, Json>;

  cause?: unknown;

  constructor(
    message: string,
    code: number,
    data?: Record<string, Json>,
    cause?: unknown,
  ) {
    super(message);
    this.code = code;
    this.data = data;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type CodifiedError = {
  name: string;
  message: string;
  code: number;
  data?: Record<string, Json>;
  stack: string | null;
};

/**
 * Error thrown when the format of input data is invalid. Should never be thrown outside handlers.
 * Useful for signaling parsing or type errors.
 *
 * @example
 * throw new FormatError('Invalid address format');
 */
export class FormatError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 0, data, cause);
    this.name = 'FormatError';
  }
}

/**
 * Error thrown when input data fails validation rules. Should never be thrown outside use cases.
 * Useful for signaling failed schema or business logic validation.
 *
 * @example
 * throw new ValidationError('Amount must be positive');
 */
export class ValidationError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 1000, data, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a requested resource cannot be found.
 * Useful for signaling missing data or entities.
 *
 * @example
 * throw new NotFoundError('Account not found');
 */
export class NotFoundError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 2000, data, cause);
    this.name = 'NotFoundError';
  }
}

/**
 * Error thrown when an external service or dependency fails.
 * Useful for signaling issues with APIs, blockchain explorers, etc.
 *
 * @example
 * throw new ExternalServiceError('Price API unavailable');
 */
export class ExternalServiceError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 3000, data, cause);
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error thrown for wallet-specific failures.
 * Useful for signaling wallet operation errors.
 *
 * @example
 * throw new WalletError('Insufficient funds');
 */
export class WalletError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 4000, data, cause);
    this.name = 'WalletError';
  }
}

/**
 * Error thrown when storage operations fail.
 * Useful for signaling database or persistence errors.
 *
 * @example
 * throw new StorageError('Failed to insert account');
 */
export class StorageError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 5000, data, cause);
    this.name = 'StorageError';
  }
}

/**
 * Error thrown when a requested method or resource does not exist or is not implemented.
 * Useful for signaling "method not found" or "not implemented" cases.
 *
 * @example
 * throw new InexistentError('Method not implemented');
 */
export class InexistentMethodError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 6000, data, cause);
    this.name = 'InexistentMethodError';
  }
}

/**
 * Error thrown when an operation is not permitted due to insufficient permissions or authorization failure.
 * Useful for signaling access control violations, such as invalid origin.
 *
 * @example
 * throw new PermissionError('Invalid origin');
 */
export class PermissionError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 7000, data, cause);
    this.name = 'PermissionError';
  }
}

/**
 * Error thrown when an operation is failing in a user interface, such as forms, prompts, or confirmations.
 *
 * @example
 * throw new UserActionError('User canceled the send flow');
 */
export class UserActionError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 8000, data, cause);
    this.name = 'UserActionError';
  }
}

/**
 * Error thrown when an assertion fails. These are errors that should never happen outside of developer errors or bugs.
 * Useful for signaling unexpected conditions that should be fixed in the code.
 *
 * @example
 * throw new AssertionError('Inconsistent state detected. Expected X, got Y', { state });
 */
export class AssertionError extends BaseError {
  constructor(message: string, data?: Record<string, Json>, cause?: unknown) {
    super(message, 9000, data, cause);
    this.name = 'AssertionError';
  }
}
