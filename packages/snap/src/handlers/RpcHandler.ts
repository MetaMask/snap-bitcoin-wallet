import { Psbt } from '@metamask/bitcoindevkit';
import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { assert, enums, object, optional, string } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { validateOrigin } from './permissions';
import { FormatError, InexistentMethodError } from '../entities';

export enum RpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
  FillAndSendPsbt = 'fillAndSendPsbt',
}

export const CreateSendFormRequest = object({
  account: string(),
  scope: optional(enums(Object.values(BtcScope))), // We don't use the scope but need to define it for validation
  assetId: optional(string()), // We don't use the Caip19 but need to define it for validation
});

export const SendPsbtRequest = object({
  account: string(),
  psbt: string(),
});

export type SendTransactionResponse = {
  txid: string;
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

    const { method, params } = request;

    if (!params) {
      throw new FormatError('Missing params');
    }

    switch (method as RpcMethod) {
      case RpcMethod.StartSendTransactionFlow: {
        assert(params, CreateSendFormRequest);
        return this.#executeSendFlow(params.account, origin);
      }
      case RpcMethod.FillAndSendPsbt: {
        assert(params, SendPsbtRequest);
        return this.#fillAndSend(params.account, params.psbt, origin);
      }

      default:
        throw new InexistentMethodError(`Method not found: ${method}`);
    }
  }

  async #executeSendFlow(
    account: string,
    origin: string,
  ): Promise<SendTransactionResponse | null> {
    const psbt = await this.#sendFlowUseCases.display(account);
    if (!psbt) {
      return null;
    }
    const txid = await this.#accountUseCases.sendPsbt(account, psbt, origin);
    return { txid: txid.toString() };
  }

  async #fillAndSend(
    account: string,
    psbtBase64: string,
    origin: string,
  ): Promise<SendTransactionResponse | null> {
    let psbt: Psbt;
    try {
      psbt = Psbt.from_string(psbtBase64);
    } catch (error) {
      throw new FormatError('Invalid PSBT', { account, psbtBase64 }, error);
    }

    const txid = await this.#accountUseCases.fillAndSendPsbt(
      account,
      psbt,
      origin,
    );

    return { txid: txid.toString() };
  }
}
