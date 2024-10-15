import { CustomError } from './utils';

export class AccountNotFoundError extends CustomError {
  constructor(errMsg?: string) {
    super(errMsg ?? `Account not found`);
  }
}

export class MethodNotImplementedError extends CustomError {
  constructor(errMsg?: string) {
    super(errMsg ?? `Method not implemented`);
  }
}

export class FeeRateUnavailableError extends CustomError {
  constructor(errMsg?: string) {
    super(errMsg ?? `No fee rates available`);
  }
}

export class SendFlowRequestNotFoundError extends CustomError {
  constructor(errMsg?: string) {
    super(errMsg ?? `Send flow request not found`);
  }
}

/**
 * Determines if the given error is a Snap exception.
 *
 * @param error - The error instance to be checked.
 * @returns A boolean indicating whether the error is a Snap .
 */
export function isSnapException(error: Error): boolean {
  const errors = [
    AccountNotFoundError,
    MethodNotImplementedError,
    FeeRateUnavailableError,
    SendFlowRequestNotFoundError,
  ];
  return errors.some((errType) => error instanceof errType);
}
