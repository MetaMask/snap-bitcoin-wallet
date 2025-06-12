import { Psbt, Address, Amount } from '@metamask/bitcoindevkit';
import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';
import { UserRejectedRequestError } from '@metamask/snaps-sdk';

import type {
  BitcoinAccountRepository,
  SendFlowRepository,
  SnapClient,
  BlockchainClient,
  SendFormContext,
  ReviewTransactionContext,
  AssetRatesClient,
  Logger,
} from '../entities';
import {
  SendFormEvent,
  ReviewTransactionEvent,
  networkToCurrencyUnit,
  CurrencyUnit,
} from '../entities';
import { CronMethod } from '../handlers';

export class SendFlowUseCases {
  readonly #logger: Logger;

  readonly #snapClient: SnapClient;

  readonly #accountRepository: BitcoinAccountRepository;

  readonly #sendFlowRepository: SendFlowRepository;

  readonly #chainClient: BlockchainClient;

  readonly #ratesClient: AssetRatesClient;

  readonly #targetBlocksConfirmation: number;

  readonly #fallbackFeeRate: number;

  readonly #ratesRefreshInterval: string;

  constructor(
    logger: Logger,
    snapClient: SnapClient,
    accountRepository: BitcoinAccountRepository,
    sendFlowRepository: SendFlowRepository,
    chainClient: BlockchainClient,
    ratesClient: AssetRatesClient,
    targetBlocksConfirmation: number,
    fallbackFeeRate: number,
    ratesRefreshInterval: string,
  ) {
    this.#logger = logger;
    this.#snapClient = snapClient;
    this.#accountRepository = accountRepository;
    this.#sendFlowRepository = sendFlowRepository;
    this.#chainClient = chainClient;
    this.#ratesClient = ratesClient;
    this.#targetBlocksConfirmation = targetBlocksConfirmation;
    this.#fallbackFeeRate = fallbackFeeRate;
    this.#ratesRefreshInterval = ratesRefreshInterval;
  }

  async display(accountId: string): Promise<Psbt> {
    this.#logger.debug('Displaying Send form. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const { locale } = await this.#snapClient.getPreferences();

    const context: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      currency: networkToCurrencyUnit[account.network],
      account: {
        id: account.id,
        address: account.peekAddress(0).address.toString(), // FIXME: Address should not be needed in the send flow
      },
      network: account.network,
      feeRate: this.#fallbackFeeRate,
      errors: {},
      locale,
    };

    const interfaceId = await this.#sendFlowRepository.insertForm(context);

    // Asynchronously start the fetching of rates background loop.
    /* eslint-disable no-void */
    void this.#refreshRates(interfaceId, context);

    // Blocks and waits for user actions
    const psbt = await this.#snapClient.displayInterface<string>(interfaceId);
    if (!psbt) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    this.#logger.info('PSBT generated successfully');
    return Psbt.from_string(psbt);
  }

  async onChangeForm(
    id: string,
    event: SendFormEvent,
    context: SendFormContext,
  ): Promise<void> {
    this.#logger.debug(
      'Event triggered on send form: %s. Event: %s',
      id,
      event,
    );

    switch (event) {
      case SendFormEvent.Cancel: {
        if (context.backgroundEventId) {
          await this.#snapClient.cancelBackgroundEvent(
            context.backgroundEventId,
          );
        }
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
      case SendFormEvent.ClearAmount: {
        const updatedContext = { ...context };
        delete updatedContext.amount;
        delete updatedContext.errors.amount;
        delete updatedContext.errors.tx;
        delete updatedContext.fee;
        delete updatedContext.drain;

        return this.#sendFlowRepository.updateForm(id, updatedContext);
      }
      case SendFormEvent.Confirm: {
        return this.#handleConfirm(id, context);
      }
      case SendFormEvent.Max: {
        return this.#handleSetMax(id, context);
      }
      case SendFormEvent.Recipient: {
        return this.#handleSetRecipient(id, context);
      }
      case SendFormEvent.Amount: {
        return this.#handleSetAmount(id, context);
      }
      case SendFormEvent.SwitchCurrency: {
        if (!context.exchangeRate) {
          return undefined;
        }

        const updatedContext = { ...context };
        updatedContext.currency =
          context.currency === CurrencyUnit.Fiat
            ? networkToCurrencyUnit[context.network]
            : CurrencyUnit.Fiat;

        return this.#sendFlowRepository.updateForm(id, updatedContext);
      }
      case SendFormEvent.Account: {
        return this.#handleSetAccount(id, context);
      }
      case SendFormEvent.Asset: {
        // Do nothing as there are no other assets
        return undefined;
      }
      default:
        throw new Error('Unrecognized event');
    }
  }

  async onChangeReview(
    id: string,
    event: ReviewTransactionEvent,
    context: ReviewTransactionContext,
  ): Promise<void> {
    this.#logger.debug(
      'Event triggered on transaction review: %s. Event: %s',
      id,
      event,
    );

    switch (event) {
      case ReviewTransactionEvent.HeaderBack: {
        // If we come from a send form, we display it again, otherwise we resolve the interface (reject)
        if (context.sendForm) {
          await this.#sendFlowRepository.updateForm(id, context.sendForm);
          return this.#refreshRates(id, context.sendForm);
        }
        return this.#snapClient.resolveInterface(id, null);
      }
      case ReviewTransactionEvent.Send: {
        return this.#snapClient.resolveInterface(id, context.psbt);
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
      throw new Error(`Form state not found when setting recipient: ${id}`);
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
      throw new Error(`Form state not found when setting amount: ${id}`);
    }

    let updatedContext = { ...context };
    delete updatedContext.errors.amount;
    delete updatedContext.errors.tx;
    delete updatedContext.fee;
    delete updatedContext.drain;

    try {
      let amount: Amount;
      if (context.currency === CurrencyUnit.Fiat && context.exchangeRate) {
        // keep everything in sats (integers) to avoid FP drift
        const sats = Math.round(
          (Number(formState.amount) * 1e8) /
            context.exchangeRate.conversionRate,
        );
        amount = Amount.from_sat(BigInt(sats));
      } else {
        // expects values to be entered in BTC and not satoshis
        amount = Amount.from_btc(Number(formState.amount));
      }

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

  async #handleConfirm(id: string, context: SendFormContext): Promise<void> {
    if (context.amount && context.recipient) {
      if (context.backgroundEventId) {
        await this.#snapClient.cancelBackgroundEvent(context.backgroundEventId);
      }

      const account = await this.#accountRepository.get(context.account.id);
      if (!account) {
        throw new Error('Account removed while confirming send flow');
      }
      const frozenUTXOs = await this.#accountRepository.getFrozenUTXOs(
        context.account.id,
      );

      const builder = account
        .buildTx()
        .feeRate(context.feeRate)
        .unspendable(frozenUTXOs);

      if (context.drain) {
        builder.drainWallet().drainTo(context.recipient);
      } else {
        builder.addRecipient(context.amount, context.recipient);
      }
      const psbt = builder.finish();

      const reviewContext: ReviewTransactionContext = {
        from: context.account.address,
        explorerUrl: this.#chainClient.getExplorerUrl(context.network),
        network: context.network,
        amount: context.amount,
        recipient: context.recipient,
        exchangeRate: context.exchangeRate,
        currency: context.currency,
        psbt: psbt.toString(),
        sendForm: context,
        locale: context.locale,
      };

      return this.#sendFlowRepository.updateReview(id, reviewContext);
    }

    throw new Error('Inconsistent Send form context');
  }

  async #handleSetAccount(id: string, context: SendFormContext): Promise<void> {
    const formState = await this.#sendFlowRepository.getState(id);
    if (!formState) {
      throw new Error(`Form state not found when switching accounts: ${id}`);
    }

    const account = await this.#accountRepository.get(
      formState.account.accountId,
    );
    if (!account) {
      throw new Error('Account not found when switching');
    }

    // We "reset" the context with the new account
    const newContext: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      account: {
        id: account.id,
        address: account.peekAddress(0).address.toString(), // FIXME: Address should not be needed in the send flow
      },
      errors: {},
      currency: context.currency,
      network: context.network,
      feeRate: context.feeRate,
      locale: context.locale,
    };

    return await this.#sendFlowRepository.updateForm(id, newContext);
  }

  async refresh(id: string): Promise<void> {
    const context = await this.#sendFlowRepository.getContext(id);
    if (!context) {
      throw new Error(`Context not found in send form: ${id}`);
    }

    return this.#refreshRates(id, context);
  }

  async #refreshRates(id: string, context: SendFormContext): Promise<void> {
    const { network } = context;
    let updatedContext = { ...context };

    const { locale, currency } = await this.#snapClient.getPreferences();

    try {
      const feeEstimates = await this.#chainClient.getFeeEstimates(network);
      const feeRate =
        feeEstimates.get(this.#targetBlocksConfirmation) ??
        this.#fallbackFeeRate;
      updatedContext.feeRate = feeRate;

      // Exchange rate is only relevant for Bitcoin
      if (network === 'bitcoin') {
        const spotPrice = await this.#ratesClient.spotPrices(currency);
        updatedContext.exchangeRate = {
          conversionRate: spotPrice.price,
          conversionDate: getCurrentUnixTimestamp(),
          currency: currency.toUpperCase(),
        };
      }

      updatedContext = await this.#computeFee(updatedContext);
    } catch (error) {
      // We do not throw so we can reschedule. Previous fetched values or fallbacks will be used.
      this.#logger.error(
        `Failed to fetch rates in send form: %s. Error: %s`,
        id,
        error,
      );
    }

    updatedContext.backgroundEventId =
      await this.#snapClient.scheduleBackgroundEvent(
        this.#ratesRefreshInterval,
        CronMethod.RefreshRates,
        id,
      );
    updatedContext.locale = locale; // Take advantage of the loop to update the locale as well

    await this.#sendFlowRepository.updateForm(id, updatedContext);
  }

  async #computeFee(context: SendFormContext): Promise<SendFormContext> {
    const { amount, recipient, drain, balance } = context;
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
          const realAmount = BigInt(balance) - fee;
          return {
            ...context,
            fee: fee.toString(),
            amount: realAmount.toString(),
            balance,
          };
        }

        const psbt = builder.addRecipient(amount, recipient).finish();
        return { ...context, fee: psbt.fee().to_sat().toString(), balance };
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
