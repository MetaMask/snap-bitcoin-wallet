import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcParams, JsonRpcRequest } from '@metamask/utils';
import { assert, enums, object, optional, string } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { handle } from './errors';
import { InternalRpcMethod, validateOrigin } from './permissions';

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

  async route(args: {
    origin: string;
    request: JsonRpcRequest;
  }): Promise<Json> {
    const { origin, request } = args;
    validateOrigin(origin, request.method);

    return handle(async () => {
      if (!request.params) {
        throw new Error('Missing params');
      }

      switch (request.method) {
        case InternalRpcMethod.StartSendTransactionFlow: {
          return this.#executeSendFlow(request.params);
        }

        default:
          throw new Error(`Method not found: ${request.method}`);
      }
    });
  }

  async #executeSendFlow(
    params: JsonRpcParams,
  ): Promise<SendTransactionResponse> {
    assert(params, CreateSendFormRequest);

    const txRequest = await this.#sendFlowUseCases.display(params.account);
    const txId = await this.#accountUseCases.send(params.account, txRequest);
    return { txId: txId.toString() };
  }
}
