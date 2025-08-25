import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { Verifier } from 'bip322-js';
import { assert, enums, object, optional, string } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { validateOrigin } from './permissions';
import {
  AssertionError,
  FormatError,
  InexistentMethodError,
  ValidationError,
} from '../entities';
import { scopeToNetwork } from './caip';
import type { TransactionFee } from './mappings';
import { mapToTransactionFees } from './mappings';
import { parsePsbt } from './parsers';

export enum RpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
  SignAndSendTransaction = 'signAndSendTransaction',
  ComputeFee = 'computeFee',
  VerifyMessage = 'verifyMessage',
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
  accountId: string(),
  transaction: string(),
  scope: enums(Object.values(BtcScope)),
});

export type SendTransactionResponse = {
  transactionId: string;
};

export const VerifyMessageRequest = object({
  address: string(),
  message: string(),
  signature: string(),
});

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
          params.accountId,
          params.transaction,
          params.scope,
        );
      }
      case RpcMethod.VerifyMessage: {
        assert(params, VerifyMessageRequest);
        return this.#verifyMessage(
          params.address,
          params.message,
          params.signature,
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
    const { txid } = await this.#accountUseCases.signPsbt(
      account,
      psbt,
      origin,
      { fill: false, broadcast: true },
    );
    if (!txid) {
      throw new AssertionError('Missing transaction ID ');
    }

    return { transactionId: txid.toString() };
  }

  async #signAndSend(
    accountId: string,
    transaction: string,
    origin: string,
  ): Promise<SendTransactionResponse | null> {
    const psbt = parsePsbt(transaction);

    const { txid } = await this.#accountUseCases.signPsbt(
      accountId,
      psbt,
      origin,
      {
        fill: true,
        broadcast: true,
      },
    );
    if (!txid) {
      throw new AssertionError('Missing transaction ID ');
    }

    return { transactionId: txid.toString() };
  }

  async #computeFee(
    accountId: string,
    transaction: string,
    scope: BtcScope,
  ): Promise<TransactionFee[]> {
    const psbt = parsePsbt(transaction);
    const amount = await this.#accountUseCases.computeFee(accountId, psbt);

    return [mapToTransactionFees(amount, scopeToNetwork[scope])];
  }

  #verifyMessage(
    address: string,
    message: string,
    signature: string,
  ): { valid: boolean } {
    try {
      const valid = Verifier.verifySignature(address, message, signature);
      return { valid };
    } catch (error) {
      throw new ValidationError(
        'Failed to verify signature',
        { address, message, signature },
        error,
      );
    }
  }
}
