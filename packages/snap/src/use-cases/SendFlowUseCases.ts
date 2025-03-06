import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';
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
  AssetRatesClient,
} from '../entities';
import { SendFormEvent, ReviewTransactionEvent } from '../entities';
import { logger } from '../infra/logger';

export class SendFlowUseCases {
  readonly #snapClient: SnapClient;

  readonly #accountRepository: BitcoinAccountRepository;

  readonly #sendFlowRepository: SendFlowRepository;

  readonly #chainClient: BlockchainClient;

  readonly #ratesClient: AssetRatesClient;

  readonly #targetBlocksConfirmation: number;

  readonly #fallbackFeeRate: number;

  readonly #ratesRefreshInterval: string;

  constructor(
    snapClient: SnapClient,
    accountRepository: BitcoinAccountRepository,
    sendFlowRepository: SendFlowRepository,
    chainClient: BlockchainClient,
    ratesClient: AssetRatesClient,
    targetBlocksConfirmation: number,
    fallbackFeeRate: number,
    ratesRefreshInterval: string,
  ) {
    this.#snapClient = snapClient;
    this.#accountRepository = accountRepository;
    this.#sendFlowRepository = sendFlowRepository;
    this.#chainClient = chainClient;
    this.#ratesClient = ratesClient;
    this.#targetBlocksConfirmation = targetBlocksConfirmation;
    this.#fallbackFeeRate = fallbackFeeRate;
    this.#ratesRefreshInterval = ratesRefreshInterval;
  }

  async display(accountId: string): Promise<TransactionRequest> {
    logger.trace('Displaying Send form view. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const interfaceId = await this.#sendFlowRepository.insertForm(
      account,
      this.#fallbackFeeRate,
    );

    // Asynchronously fetch the rates and start the background loop.
    /* eslint-disable no-void */
    void this.refreshRates(interfaceId);

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

  async onFormInput(id: string, event: SendFormEvent): Promise<void> {
    logger.trace('Send form input. ID: %s. Event: %s', id, event);

    // TODO: Temporary fetch the context while this is fixed: https://github.com/MetaMask/snaps/issues/3069
    const context = await this.#sendFlowRepository.getContext(id);
    if (!context) {
      throw new Error(`Context not found. Interface ID: ${id}`);
    }

    switch (event) {
      case SendFormEvent.Cancel: {
        return this.#snapClient.resolveInterface(id, null);
      }
      case SendFormEvent.ClearRecipient: {
        const updatedContext = { ...context };
        delete updatedContext.recipient;
        delete updatedContext.errors.recipient;
        delete updatedContext.errors.tx;
        delete updatedContext.fee;

        return this.#sendFlowRepository.updateForm(id, updatedContext);
      }
      case SendFormEvent.Confirm: {
        if (context.backgroundEventId) {
          await this.#snapClient.cancelBackgroundEvent(
            context.backgroundEventId,
          );
        }

        if (context.amount && context.recipient && context.fee) {
          const reviewContext: ReviewTransactionContext = {
            from: context.account.address,
            network: context.network,
            amount: context.amount,
            recipient: context.recipient,
            feeRate: context.feeRate,
            exchangeRate: context.exchangeRate,
            currency: context.currency,
            fee: context.fee,
            sendForm: context,
          };
          return this.#sendFlowRepository.updateReview(id, reviewContext);
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

  async onReviewInput(
    id: string,
    event: ReviewTransactionEvent,
    context: ReviewTransactionContext,
  ): Promise<void> {
    logger.trace('Updating transaction review. ID: %s. Event: %s', id, event);

    switch (event) {
      case ReviewTransactionEvent.HeaderBack: {
        // If we come from a send form, we display it again, otherwise we resolve the interface (reject)
        if (context.sendForm) {
          /* eslint-disable no-void */
          void this.refreshRates(id);
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
    if (!formState) {
      throw new Error(
        `Form state not found when setting recipient. Interface ID: ${id}`,
      );
    }

    let updatedContext = { ...context };
    delete updatedContext.errors.recipient;
    delete updatedContext.errors.tx;

    try {
      updatedContext.recipient = Address.from_string(
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
    if (!formState) {
      throw new Error(
        `Form state not found when setting amount. Interface ID: ${id}`,
      );
    }

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

  async refreshRates(id: string): Promise<void> {
    logger.trace('Send form refresh rates. ID: %s', id);

    let context = await this.#sendFlowRepository.getContext(id);
    if (!context) {
      logger.debug('Gracefully terminating background event loop. ID: %s', id);
      return;
    }

    try {
      const feeEstimates = await this.#chainClient.getFeeEstimates(
        context.network,
      );
      const feeRate =
        feeEstimates.get(this.#targetBlocksConfirmation) ??
        this.#fallbackFeeRate;
      context.feeRate = feeRate;

      // Fiat rate is only relevant for Bitcoin
      if (context.network === 'bitcoin') {
        const exchangeRates = await this.#ratesClient.exchangeRates();
        const { currency } = await this.#snapClient.getPreferences();
        const conversionRate = exchangeRates[currency];
        if (conversionRate) {
          context.exchangeRate = {
            conversionRate: exchangeRates[currency].value,
            conversionDate: getCurrentUnixTimestamp(),
            currency: currency.toUpperCase(),
          };
        }
      }

      context = await this.#computeFee(context);
    } catch (error) {
      // We do not throw so we can reschedule. Previous fetched values or fallbacks will be used.
      logger.error(
        `Failed to fetch rates in send form, ID: %s. Error: %s`,
        id,
        error,
      );
    }

    const backgroundEventId = await this.#snapClient.scheduleBackgroundEvent(
      this.#ratesRefreshInterval,
      SendFormEvent.RefreshRates,
      id,
    );
    context.backgroundEventId = backgroundEventId;

    await this.#sendFlowRepository.updateForm(id, context);
  }

  async #computeFee(context: SendFormContext): Promise<SendFormContext> {
    const { amount, recipient, drain } = context;
    if (amount && recipient) {
      const account = await this.#accountRepository.get(context.account.id);
      if (!account) {
        throw new Error('Account removed while sending');
      }
      const frozenUTXOs = await this.#accountRepository.getFrozenUTXOs(
        context.account.id,
      );

      try {
        const builder = account
          .buildTx()
          .feeRate(context.feeRate)
          .unspendable(frozenUTXOs);

        if (drain) {
          const psbt = builder.drainWallet().drainTo(recipient).finish();
          const fee = psbt.fee().to_sat();
          const realAmount = BigInt(amount) - fee;
          return {
            ...context,
            fee: fee.toString(),
            amount: realAmount.toString(),
          };
        }

        const psbt = builder.addRecipient(amount, recipient).finish();
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
