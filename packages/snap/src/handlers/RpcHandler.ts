import type { JsonRpcParams } from '@metamask/snaps-sdk';
import { InvalidParamsError, MethodNotFoundError } from '@metamask/snaps-sdk';
import { assert, nonempty, object, string } from 'superstruct';

import { InternalRpcMethod } from '../permissions';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

export const SendBitcoinRequest = object({
  account: nonempty(string()),
});

export class RpcHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(method: string, params?: JsonRpcParams): Promise<string> {
    switch (method) {
      case InternalRpcMethod.StartSendTransactionFlow: {
        try {
          assert(params, SendBitcoinRequest);
        } catch (error) {
          throw new InvalidParamsError(error.message) as unknown as Error;
        }

        return 'txid';
      }

      default:
        throw new MethodNotFoundError() as unknown as Error;
    }
  }
}
