import type { Json } from '@metamask/utils';

export class BaseError extends Error {
  code: number;

  data?: Record<string, Json>;

  constructor(message: string, code: number, data?: Record<string, Json>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): CodifiedError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      data: this.data,
    };
  }
}

export type CodifiedError = {
  name: string;
  message: string;
  code: number;
  data?: Record<string, Json>;
};

/**
 * Error thrown when the format of input data is invalid. Should never be thrown outside handlers.
 * Useful for signaling parsing or type errors.
 *
 * @example
 * throw new FormatError('Invalid address format');
 */
export class FormatError extends BaseError {
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 0, data);
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
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 1000, data);
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
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 2000, data);
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
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 3000, data);
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
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 4000, data);
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
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 5000, data);
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
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 6000, data);
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
  constructor(message: string, data?: Record<string, Json>) {
    super(message, 7000, data);
  }
}
