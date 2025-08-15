import { Psbt } from '@metamask/bitcoindevkit';
import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { assert, enums, object, optional, string } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { validateOrigin } from './permissions';
import { FormatError, InexistentMethodError } from '../entities';
import { scopeToNetwork } from './caip';
import type { TransactionFee } from './mappings';
import { mapToTransactionFees } from './mappings';

export enum RpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
  SignAndSendTransaction = 'signAndSendTransaction',
  ComputeFee = 'computeFee',
}

export const CreateSendFormRequest = object({
  account: string(),
  scope: optional(enums(Object.values(BtcScope))), // We don't use the scope but need to define it for validation
  assetId: optional(string()), // We don't use the Caip19 but need to define it for validation
});

export const SendPsbtRequest = object({
  accountId: string(),
  transaction: string(),
  scope: optional(enums(Object.values(BtcScope))), // We don't use the scope but need to define it for validation
});

export const ComputeFeeRequest = object({
  account: string(),
  transaction: string(),
  scope: enums(Object.values(BtcScope)),
});

export type SendTransactionResponse = {
  transactionId: string;
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
      case RpcMethod.SignAndSendTransaction: {
        assert(params, SendPsbtRequest);
        return this.#signAndSend(params.accountId, params.transaction, origin);
      }
      case RpcMethod.ComputeFee: {
        assert(params, ComputeFeeRequest);
        return this.#computeFee(
          params.account,
          params.transaction,
          params.scope,
        );
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
    return { transactionId: txid.toString() };
  }

  async #signAndSend(
    accountId: string,
    transaction: string,
    origin: string,
  ): Promise<SendTransactionResponse | null> {
    const psbt: Psbt = this.#parsePsbt(transaction, accountId);

    const txid = await this.#accountUseCases.fillAndSendPsbt(
      accountId,
      psbt,
      origin,
    );

    return { transactionId: txid.toString() };
  }

  async #computeFee(
    accountId: string,
    transaction: string,
    scope: BtcScope,
  ): Promise<TransactionFee[]> {
    const psbt = this.#parsePsbt(transaction, accountId);
    const amount = await this.#accountUseCases.computeFee(accountId, psbt);

    return [mapToTransactionFees(amount, scopeToNetwork[scope])];
  }

  #parsePsbt(transaction: string, accountId: string): Psbt {
    try {
      return Psbt.from_string(transaction);
    } catch (error) {
      throw new FormatError('Invalid PSBT', { accountId, transaction }, error);
    }
  }
}
