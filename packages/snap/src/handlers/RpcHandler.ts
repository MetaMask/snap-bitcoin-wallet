import { BtcScope } from '@metamask/keyring-api';
import type { Json, JsonRpcRequest } from '@metamask/snaps-sdk';
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
  validateDustLimit,
  parseRewardsMessage,
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

export const SignRewardsMessageRequest = object({
  accountId: string(),
  message: string(),
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
      case RpcMethod.SignRewardsMessage: {
        assert(params, SignRewardsMessageRequest);
        return this.#signRewardsMessage(params.accountId, params.message);
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
      const dustValidation = validateDustLimit(value, bitcoinAccount);
      if (!dustValidation.valid) {
        return dustValidation;
      }
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
        validateAddress(request.toAddress, account.network, this.#logger)
          .valid &&
        validateDustLimit(request.amount, account).valid;

      if (!inputValidation) {
        return INVALID_RESPONSE;
      }

      const balanceValidation = validateAccountBalance(request.amount, account);

      if (!balanceValidation.valid) {
        return balanceValidation;
      }

      const transaction = await this.#sendFlowUseCases.confirmSendFlow(
        account,
        request.amount,
        request.toAddress,
      );
      return mapPsbtToTransaction(account, transaction);
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

      const errorMessage = (error as CodifiedError).message;
      this.#logger.error('An error occurred: %s', errorMessage);

      throw error;
    }
  }

  /**
   * Handles the signing of a rewards message, of format 'rewards,{address},{timestamp}' base64 encoded.
   *
   * @param accountId - The ID of the account to sign with
   * @param message - The base64-encoded rewards message
   * @returns The signature
   * @throws {ValidationError} If the account is not found or if the address in the message doesn't match the signing account
   */
  async #signRewardsMessage(
    accountId: string,
    message: string,
  ): Promise<{ signature: string }> {
    const { address: messageAddress } = parseRewardsMessage(message);

    const account = await this.#accountUseCases.get(accountId);
    if (!account) {
      throw new ValidationError('Account not found', { accountId });
    }

    const addressValidation = validateAddress(
      messageAddress,
      account.network,
      this.#logger,
    );
    if (!addressValidation.valid) {
      throw new ValidationError(
        `Invalid Bitcoin address in rewards message for network ${account.network}`,
        { messageAddress, network: account.network },
      );
    }

    const accountAddress = account.publicAddress.toString();
    if (messageAddress !== accountAddress) {
      throw new ValidationError(
        `Address in rewards message (${messageAddress}) does not match signing account address (${accountAddress})`,
        { messageAddress, accountAddress },
      );
    }

    const decodedMessage = atob(message);

    const signature = await this.#accountUseCases.signMessage(
      accountId,
      decodedMessage,
      'metamask',
      { skipConfirmation: true },
    );

    return { signature };
  }
}
