import { Json, JsonRpcParams } from '@metamask/utils';
import { InternalRpcMethod } from '../permissions';
import { SendFormUseCases } from '../use-cases';
import { assert, enums, object, optional, string } from 'superstruct';
import { BtcScopes } from '@metamask/keyring-api';

const CreateSendFormRequest = object({
  account: string(),
  scope: optional(enums(Object.values(BtcScopes))), // We don't use the scope but need to define it for validation
});

type CreateSendFormResponse = {
  txId: string;
};

export class RpcHandler {
  readonly #sendFormUseCases: SendFormUseCases;

  constructor(sendForm: SendFormUseCases) {
    this.#sendFormUseCases = sendForm;
  }

  async route(method: string, params?: JsonRpcParams): Promise<Json> {
    switch (method) {
      case InternalRpcMethod.StartSendTransactionFlow: {
        if (!params) throw new Error('Missing params');
        assert(params, CreateSendFormRequest);
        return await this.start(params.account);
      }

      default:
        throw new Error(`Method not found: ${method}`);
    }
  }

  async start(account: string): Promise<CreateSendFormResponse> {
    const sendForm = await this.#sendFormUseCases.create(account);
    const request = await this.#sendFormUseCases.display(sendForm);

    return { txId: request.id };
  }
}
