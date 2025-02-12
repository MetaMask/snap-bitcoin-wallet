import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import { Address, Amount } from 'bitcoindevkit';

import type {
  BitcoinAccountRepository,
  SendFlowRepository,
  SnapClient,
  BlockchainClient,
  TransactionRequest,
  SendFormContext,
  ReviewTransactionContext,
} from '../entities';
import {
  SendFormEvent,
  ReviewTransactionEvent,
  networkToCurrencyUnit,
} from '../entities';
import { logger } from '../utils';

export class SendFlowUseCases {
  readonly #snapClient: SnapClient;

  readonly #accountRepository: BitcoinAccountRepository;

  readonly #sendFlowRepository: SendFlowRepository;

  readonly #chainClient: BlockchainClient;

  readonly #targetBlocksConfirmation: number;

  readonly #fallbackFeeRate: number;

  constructor(
    snapClient: SnapClient,
    accountRepository: BitcoinAccountRepository,
    sendFormrepository: SendFlowRepository,
    chainClient: BlockchainClient,
    targetBlocksConfirmation: number,
    fallbackFeeRate: number,
  ) {
    this.#snapClient = snapClient;
    this.#accountRepository = accountRepository;
    this.#sendFlowRepository = sendFormrepository;
    this.#chainClient = chainClient;
    this.#targetBlocksConfirmation = targetBlocksConfirmation;
    this.#fallbackFeeRate = fallbackFeeRate;
  }

  async display(accountId: string): Promise<TransactionRequest> {
    logger.trace('Displaying Send form view. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    // TODO: Fetch fee rates from state and refresh on updates
    const feeEstimates = await this.#chainClient.getFeeEstimates(
      account.network,
    );
    const feeRate =
      feeEstimates.get(this.#targetBlocksConfirmation) ?? this.#fallbackFeeRate;

    // TODO: Fetch fiat/fee rates from state and refresh on updates
    const fiatRate = await this.#snapClient.getCurrencyRate(
      networkToCurrencyUnit[account.network],
    );

    const interfaceId = await this.#sendFlowRepository.insertForm(
      account,
      feeRate,
      fiatRate,
    );

    // Blocks and waits for user actions
    const request = await this.#snapClient.displayInterface<TransactionRequest>(
      interfaceId,
    );
    if (!request) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    logger.debug('Transaction request generated successfully: %o', request);
    return request;
  }

  async updateForm(
    id: string,
    event: SendFormEvent,
    context: SendFormContext,
  ): Promise<void> {
    logger.trace('Updating Send form. ID: %s. Event: %s', id, event);

    switch (event) {
      case SendFormEvent.Cancel: {
        return await this.#snapClient.resolveInterface(id, null);
      }
      case SendFormEvent.ClearRecipient: {
        const updatedContext = { ...context };
        delete updatedContext.recipient;
        delete updatedContext.errors.recipient;
        delete updatedContext.errors.tx;
        delete updatedContext.fee;

        return await this.#sendFlowRepository.updateForm(id, updatedContext);
      }
      case SendFormEvent.Confirm: {
        if (context.amount && context.recipient && context.fee) {
          const reviewContext: ReviewTransactionContext = {
            from: context.account.address,
            network: context.network,
            amount: context.amount,
            recipient: context.recipient,
            feeRate: context.feeRate,
            fiatRate: context.fiatRate,
            currency: context.currency,
            fee: context.fee,
            sendForm: context,
          };
          return await this.#sendFlowRepository.updateReview(id, reviewContext);
        }
        throw new Error('Inconsistent Send form context');
      }
      case SendFormEvent.SetMax: {
        return this.#handleSetMax(id, context);
      }
      case SendFormEvent.Recipient: {
        return this.#handleSetRecipient(id, context);
      }
      case SendFormEvent.Amount: {
        return this.#handleSetAmount(id, context);
      }
      default:
        throw new Error('Unrecognized event');
    }
  }

  async updateReview(
    id: string,
    event: ReviewTransactionEvent,
    context: ReviewTransactionContext,
  ): Promise<void> {
    logger.trace('Updating transaction review. ID: %s. Event: %s', id, event);

    switch (event) {
      case ReviewTransactionEvent.HeaderBack: {
        // If we come from a send form, we display it again, otherwise we resolve the interface (reject)
        if (context.sendForm) {
          return this.#sendFlowRepository.updateForm(id, context.sendForm);
        }

        return this.#snapClient.resolveInterface(id, null);
      }
      case ReviewTransactionEvent.Send: {
        const { amount, feeRate, recipient } = context;
        const txRequest: TransactionRequest = {
          feeRate,
          amount,
          recipient,
        };
        return this.#snapClient.resolveInterface(id, txRequest);
      }
      default:
        throw new Error('Unrecognized event');
    }
  }

  async #handleSetMax(id: string, context: SendFormContext): Promise<void> {
    let updatedContext: SendFormContext = {
      ...context,
      amount: context.balance,
      drain: true,
    };
    delete updatedContext.errors.amount;
    delete updatedContext.errors.tx;
    delete updatedContext.fee;

    updatedContext = await this.#computeFee(updatedContext);
    return await this.#sendFlowRepository.updateForm(id, updatedContext);
  }

  async #handleSetRecipient(
    id: string,
    context: SendFormContext,
  ): Promise<void> {
    const formState = await this.#sendFlowRepository.getState(id);

    let updatedContext = { ...context };
    delete updatedContext.errors.recipient;
    delete updatedContext.errors.tx;

    try {
      updatedContext.recipient = Address.new(
        formState.recipient,
        context.network,
      ).toString();
      updatedContext = await this.#computeFee(updatedContext);
    } catch (error) {
      updatedContext.errors = {
        ...updatedContext.errors,
        recipient: error instanceof Error ? error.message : String(error),
      };
    }

    return await this.#sendFlowRepository.updateForm(id, updatedContext);
  }

  async #handleSetAmount(id: string, context: SendFormContext): Promise<void> {
    const formState = await this.#sendFlowRepository.getState(id);

    let updatedContext = { ...context };
    delete updatedContext.errors.amount;
    delete updatedContext.errors.tx;
    delete updatedContext.fee;
    delete updatedContext.drain;

    try {
      // We expect amounts to be entered in Bitcoin
      const amount = Amount.from_btc(Number(formState.amount));
      updatedContext.amount = amount.to_sat().toString();
      updatedContext = await this.#computeFee(updatedContext);
    } catch (error) {
      updatedContext.errors = {
        ...updatedContext.errors,
        amount: error instanceof Error ? error.message : String(error),
      };
    }

    return await this.#sendFlowRepository.updateForm(id, updatedContext);
  }

  async #computeFee(context: SendFormContext): Promise<SendFormContext> {
    const { amount, recipient, drain } = context;
    if (amount && recipient) {
      const account = await this.#accountRepository.get(context.account.id);
      if (!account) {
        throw new Error('Account removed while sending');
      }

      try {
        if (drain) {
          const psbt = account.drainTo(context.feeRate, recipient);
          const fee = psbt.fee().to_sat();
          const realAmount = BigInt(amount) - fee;
          return {
            ...context,
            fee: fee.toString(),
            amount: realAmount.toString(),
          };
        }

        const psbt = account.buildTx(context.feeRate, recipient, amount);
        return { ...context, fee: psbt.fee().to_sat().toString() };
      } catch (error) {
        return {
          ...context,
          errors: {
            ...context.errors,
            tx: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    return context;
  }
}
