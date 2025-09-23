import type { Psbt, Txid } from '@metamask/bitcoindevkit';
import { Address } from '@metamask/bitcoindevkit';
import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { Verifier } from 'bip322-js';
import { assert, enums, object, optional, string } from 'superstruct';

import {
  AssertionError,
  type CodifiedError,
  FormatError,
  InexistentMethodError,
  type Logger,
  ValidationError,
} from '../entities';
import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { scopeToNetwork } from './caip';
import type { TransactionFee } from './mappings';
import { mapToTransactionFees } from './mappings';
import { parsePsbt } from './parsers';
import type {
  ConfirmSendRequest,
  OnAddressInputRequest,
  OnAmountInputRequest,
} from './types';
import type { ValidationResponse } from './validation';
import {
  ConfirmSendRequestStruct,
  RpcMethod,
  SendErrorCodes,
  OnAddressInputRequestStruct,
  OnAmountInputRequestStruct,
} from './validation';

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
        return this.#signAndSend(params.accountId, params.transaction, origin, {
          fill: true,
          broadcast: true,
        });
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
      case RpcMethod.ConfirmSend: {
        assert(params, ConfirmSendRequestStruct);
        return await this.#confirmSend(params, origin);
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
    options: { fill: boolean; broadcast: boolean },
  ): Promise<SendTransactionResponse> {
    const psbt = parsePsbt(transaction);

    const txid = await this.#signPsbt(accountId, origin, psbt, options);
    return { transactionId: txid.toString() };
  }

  async #signPsbt(
    accountId: string,
    origin: string,
    psbt: Psbt,
    options: { fill: boolean; broadcast: boolean },
  ): Promise<Txid> {
    const { txid } = await this.#accountUseCases.signPsbt(
      accountId,
      psbt,
      origin,
      options,
    );

    if (!txid) {
      throw new AssertionError('Missing transaction ID ');
    }

    return txid;
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

  async #confirmSend(
    request: ConfirmSendRequest,
    origin: string,
  ): Promise<Json> {
    try {
      const account = await this.#accountUseCases.get(request.fromAccountId);
      const feeRate = await this.#accountUseCases.getFallbackFeeRate(account);
      const frozenUTXOs = await this.#accountUseCases.getFrozenUTXOs(
        account.id,
      );

      const psbt = account
        .buildTx()
        .feeRate(feeRate)
        .unspendable(frozenUTXOs)
        .addRecipient(request.amount, request.toAddress)
        .finish();

      // TODO: map to a KeyringTransaction
      return this.#signAndSend(account.id, psbt.toString(), origin, {
        fill: true,
        broadcast: false,
      });
    } catch (error) {
      this.#logger.error(
        'An error occurred: %s',
        (error as CodifiedError).message,
      );
      throw error;
    }
  }
}
