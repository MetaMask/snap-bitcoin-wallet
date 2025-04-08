import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { assert, enums, object, optional, string } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { handle } from './errors';
import { validateOrigin } from './permissions';

export enum RpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
}

export const CreateSendFormRequest = object({
  account: string(),
  scope: optional(enums(Object.values(BtcScope))), // We don't use the scope but need to define it for validation
});

type SendTransactionResponse = {
  txId: string;
};

export class RpcHandler {
  readonly #sendFlowUseCases: SendFlowUseCases;

  readonly #accountUseCases: AccountUseCases;

  constructor(sendFlow: SendFlowUseCases, accounts: AccountUseCases) {
    this.#sendFlowUseCases = sendFlow;
    this.#accountUseCases = accounts;
  }

  async route(origin: string, request: JsonRpcRequest): Promise<Json> {
    validateOrigin(origin);

    return handle(async () => {
      if (!request.params) {
        throw new Error('Missing params');
      }

      switch (request.method) {
        case RpcMethod.StartSendTransactionFlow: {
          assert(request.params, CreateSendFormRequest);
          return this.#executeSendFlow(request.params.account);
        }

        default:
          throw new Error(`Method not found: ${request.method}`);
      }
    });
  }

  async #executeSendFlow(account: string): Promise<SendTransactionResponse> {
    const txRequest = await this.#sendFlowUseCases.display(account);
    const txId = await this.#accountUseCases.send(account, txRequest);
    return { txId: txId.toString() };
  }
}
