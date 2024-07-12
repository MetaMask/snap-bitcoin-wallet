import { CustomError } from './utils';

export class AccountNotFoundError extends CustomError {
  constructor(errMsg?: string) {
    super(errMsg ?? `Account not found`);
  }
}
