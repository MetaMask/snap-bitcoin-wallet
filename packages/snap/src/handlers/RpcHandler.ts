import { BtcScopes } from '@metamask/keyring-api';
import type { Json, JsonRpcParams } from '@metamask/utils';
import { assert, enums, object, optional, string } from 'superstruct';

import { InternalRpcMethod } from '../permissions';
import type { AccountUseCases, SendFlowUseCases } from '../use-cases';

export const CreateSendFormRequest = object({
  account: string(),
  scope: optional(enums(Object.values(BtcScopes))), // We don't use the scope but need to define it for validation
});

type SendTransactionResponse = {
  txId: string;
};

export class RpcHandler {
  readonly #sendFormUseCases: SendFlowUseCases;

  readonly #accountUseCases: AccountUseCases;

  constructor(sendForm: SendFlowUseCases, accounts: AccountUseCases) {
    this.#sendFormUseCases = sendForm;
    this.#accountUseCases = accounts;
  }

  async route(method: string, params?: JsonRpcParams): Promise<Json> {
    if (!params) {
      throw new Error('Missing params');
    }

    switch (method) {
      case InternalRpcMethod.StartSendTransactionFlow: {
        return this.#executeSendFlow(params);
      }

      default:
        throw new Error(`Method not found: ${method}`);
    }
  }

  async #executeSendFlow(
    params: JsonRpcParams,
  ): Promise<SendTransactionResponse> {
    assert(params, CreateSendFormRequest);

    const txRequest = await this.#sendFormUseCases.display(params.account);
    const txId = await this.#accountUseCases.send(params.account, txRequest);
    return { txId };
  }
}
