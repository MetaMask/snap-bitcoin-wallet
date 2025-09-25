import { Amount } from '@metamask/bitcoindevkit';
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
import { mapPsbtToTransaction, mapToTransactionFees } from './mappings';
import { parsePsbt } from './parsers';
import type {
  ConfirmSendRequest,
  OnAddressInputRequest,
  OnAmountInputRequest,
} from './types';
import type { ValidationResponse } from './validation';
import {
  NO_ERRORS_RESPONSE,
  INVALID_RESPONSE,
  ConfirmSendRequestStruct,
  OnAddressInputRequestStruct,
  OnAmountInputRequestStruct,
  RpcMethod,
  SendErrorCodes,
  validateAmount,
  validateAddress,
  validateAccountBalance,
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
      case RpcMethod.ConfirmSend: {
        assert(params, ConfirmSendRequestStruct);
        return await this.#confirmSend(params);
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

  async #onAddressInput(
    request: OnAddressInputRequest,
  ): Promise<ValidationResponse> {
    const { value, accountId } = request;

    try {
      // get the scope of the account so we can validate the address against the
      // appropriate network (e.g. mainnet, testnet etc)
      const bitcoinAccount = await this.#accountUseCases.get(accountId);

      return validateAddress(value, bitcoinAccount.network, this.#logger);
    } catch (error) {
      this.#logger.error(
        `Invalid account. Error: %s`,
        (error as CodifiedError).message,
      );

      return INVALID_RESPONSE;
    }
  }

  async #onAmountInput(
    request: OnAmountInputRequest,
  ): Promise<ValidationResponse> {
    const { value, accountId } = request;

    const amountValidation = validateAmount(value);
    if (!amountValidation.valid) {
      return amountValidation;
    }

    try {
      const bitcoinAccount = await this.#accountUseCases.get(accountId);
      const balanceValidation = validateAccountBalance(value, bitcoinAccount);

      return balanceValidation.valid ? NO_ERRORS_RESPONSE : balanceValidation;
    } catch (error) {
      this.#logger.error(
        'An error occurred: %s',
        (error as CodifiedError).message,
      );
      return INVALID_RESPONSE;
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

  async #confirmSend(request: ConfirmSendRequest): Promise<Json> {
    try {
      const account = await this.#accountUseCases.get(request.fromAccountId);

      const inputValidation =
        validateAmount(request.amount).valid &&
        validateAddress(request.toAddress, account.network, this.#logger).valid;

      if (!inputValidation) {
        return INVALID_RESPONSE;
      }

      const balanceValidation = validateAccountBalance(request.amount, account);

      if (!balanceValidation.valid) {
        return balanceValidation;
      }

      const amountInSats = Amount.from_btc(Number(request.amount))
        .to_sat()
        .toString();

      try {
        const templatePsbt = account
          .buildTx()
          .addRecipient(amountInSats, request.toAddress)
          .finish();

        const { psbt: signedPsbtString } = await this.#accountUseCases.signPsbt(
          account.id,
          templatePsbt,
          'metamask',
          {
            fill: true,
            broadcast: false, // this is confirmation flow we don't want to broadcast
          },
        );

        const signedPsbt = parsePsbt(signedPsbtString);
        const tx = account.extractTransaction(signedPsbt);
        return mapPsbtToTransaction(account, tx);
      } catch (error) {
        const { message } = error as CodifiedError;

        // we have tested for account balance earlier so if we get
        // and insufficient funds message when trying to sign the PBST
        // it will be because of insufficient fees
        if (message.includes('Insufficient funds')) {
          return {
            valid: false,
            errors: [{ code: SendErrorCodes.InsufficientBalanceToCoverFee }],
          };
        }

        throw error;
      }
    } catch (error) {
      const errorMessage = (error as CodifiedError).message;
      this.#logger.error('An error occurred: %s', errorMessage);

      throw error;
    }
  }
}
