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
