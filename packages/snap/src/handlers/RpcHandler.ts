import { Address } from '@metamask/bitcoindevkit';
import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { assert, enums, object, optional, string } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { validateOrigin } from './permissions';
import {
  AssertionError,
  type CodifiedError,
  FormatError,
  InexistentMethodError,
  type Logger,
} from '../entities';
import { scopeToNetwork } from './caip';
import type { TransactionFee } from './mappings';
import { mapToTransactionFees } from './mappings';
import { parsePsbt } from './parsers';
import type { OnAddressInputRequest, OnAmountInputRequest } from './types';
import type { ValidationResponse } from './validation';
import {
  SendErrorCodes,
  OnAddressInputRequestStruct,
  checkEmptyStringParams,
  OnAmountInputRequestStruct,
} from './validation';

export enum RpcMethod {
  StartSendTransactionFlow = 'startSendTransactionFlow',
  SignAndSendTransaction = 'signAndSendTransaction',
  ComputeFee = 'computeFee',
  OnAddressInput = 'onAddressInput',
  OnAmountInput = 'onAmountInput',
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

export class RpcHandler {
  readonly #logger: Logger;

  readonly #sendFlowUseCases: SendFlowUseCases;

  readonly #accountUseCases: AccountUseCases;

  constructor(
    sendFlow: SendFlowUseCases,
    accounts: AccountUseCases,
    logger: Logger,
  ) {
    this.#logger = logger;
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
      case RpcMethod.OnAddressInput: {
        assert(params, OnAddressInputRequestStruct);
        return this.#onAddressInput(params);
      }
      case RpcMethod.OnAmountInput: {
        assert(params, OnAmountInputRequestStruct);
        return this.#onAmountInput(params);
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

  async #onAddressInput(
    request: OnAddressInputRequest,
  ): Promise<ValidationResponse> {
    const { value, accountId } = request;

    const requiredResponse = checkEmptyStringParams([value, accountId]);
    if (requiredResponse !== null) {
      return requiredResponse;
    }

    try {
      // get the scope of the account so we can validate the address against the
      // appropriate network (e.g. mainnet, testnet etc)
      const bitcoinAccount = await this.#accountUseCases.get(accountId);

      // try to parse the input address or throw if invalid.
      Address.from_string(value, bitcoinAccount.network).toString();
    } catch (error) {
      this.#logger.error(
        `Invalid account and/or invalid address. Error: %s`,
        (error as CodifiedError).message,
      );

      return {
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      };
    }

    return {
      valid: true,
      errors: [],
    };
  }

  async #onAmountInput(
    request: OnAmountInputRequest,
  ): Promise<ValidationResponse> {
    const { value, accountId } = request;

    const requiredCheck = checkEmptyStringParams([value, accountId]);
    if (requiredCheck) {
      return requiredCheck;
    }

    const valueToNumber = Number(value);
    if (!Number.isFinite(valueToNumber) || valueToNumber <= 0) {
      return { valid: false, errors: [{ code: SendErrorCodes.Invalid }] };
    }

    try {
      const bitcoinAccount = await this.#accountUseCases.get(accountId);
      const balance = bitcoinAccount.balance.trusted_spendable.to_btc();

      if (valueToNumber > balance) {
        return {
          valid: false,
          errors: [{ code: SendErrorCodes.InsufficientBalance }],
        };
      }

      return { valid: true, errors: [] };
    } catch (error) {
      this.#logger.error(
        'An error occurred: %s',
        (error as CodifiedError).message,
      );
      return { valid: false, errors: [{ code: SendErrorCodes.Invalid }] };
    }
  }
}
