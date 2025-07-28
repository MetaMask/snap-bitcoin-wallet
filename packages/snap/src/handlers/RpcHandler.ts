import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { assert, enums, object, optional, string } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import type { HandlerMiddleware } from './HandlerMiddleware';

export enum RpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
}

export const CreateSendFormRequest = object({
  account: string(),
  scope: optional(enums(Object.values(BtcScope))), // We don't use the scope but need to define it for validation
  assetId: optional(string()), // We don't use the Caip19 but need to define it for validation
});

type SendTransactionResponse = {
  txId: string;
};

export class RpcHandler {
  readonly #middleware: HandlerMiddleware;

  readonly #sendFlowUseCases: SendFlowUseCases;

  readonly #accountUseCases: AccountUseCases;

  constructor(
    middleware: HandlerMiddleware,
    sendFlow: SendFlowUseCases,
    accounts: AccountUseCases,
  ) {
    this.#middleware = middleware;
    this.#sendFlowUseCases = sendFlow;
    this.#accountUseCases = accounts;
  }

  async route(origin: string, request: JsonRpcRequest): Promise<Json> {
    return this.#middleware.handle(async () => {
      this.#middleware.validateOrigin(origin);

      const { method, params } = request;

      if (!params) {
        throw new Error('Missing params');
      }

      switch (method as RpcMethod) {
        case RpcMethod.StartSendTransactionFlow: {
          assert(params, CreateSendFormRequest);
          return this.#executeSendFlow(params.account, origin);
        }

        default:
          throw new Error(`Method not found: ${method}`);
      }
    });
  }

  async #executeSendFlow(
    account: string,
    origin: string,
  ): Promise<SendTransactionResponse> {
    const psbt = await this.#sendFlowUseCases.display(account);
    const txId = await this.#accountUseCases.sendPsbt(account, psbt, origin);
    return { txId: txId.toString() };
  }
}
