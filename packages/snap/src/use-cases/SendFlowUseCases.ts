import {
  type Network,
  Address,
  Amount,
  Psbt,
  type Transaction,
} from '@metamask/bitcoindevkit';
import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';
import type { CurrencyRate, InputChangeEvent } from '@metamask/snaps-sdk';

import type {
  AssetRatesClient,
  BitcoinAccount,
  BitcoinAccountRepository,
  BlockchainClient,
  CodifiedError,
  Logger,
  ConfirmSendFormContext,
  ReviewTransactionContext,
  SendFlowRepository,
  SendFormContext,
  SnapClient,
} from '../entities';
import {
  AssertionError,
  CurrencyUnit,
  networkToCurrencyUnit,
  NotFoundError,
  ReviewTransactionEvent,
  SendFormEvent,
  UserActionError,
} from '../entities';
import type { AccountUseCases } from './AccountUseCases';
import { CronMethod } from '../handlers';
import { parsePsbt } from '../handlers/parsers';

type SetAccountEventValue = {
  accountId: string;
};

export class SendFlowUseCases {
  readonly #logger: Logger;

  readonly #snapClient: SnapClient;

  readonly #accountRepository: BitcoinAccountRepository;

  readonly #accountUseCases: AccountUseCases;

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
    accounts: AccountUseCases,
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
    this.#accountUseCases = accounts;
    this.#sendFlowRepository = sendFlowRepository;
    this.#chainClient = chainClient;
    this.#ratesClient = ratesClient;
    this.#targetBlocksConfirmation = targetBlocksConfirmation;
    this.#fallbackFeeRate = fallbackFeeRate;
    this.#ratesRefreshInterval = ratesRefreshInterval;
  }

  async confirmSendFlow(
    account: BitcoinAccount,
    amount: string,
    toAddress: string,
  ): Promise<Transaction> {
    const amountInSats = Amount.from_btc(Number(amount)).to_sat();
    const templatePsbt = account.buildTx();
    const { locale, currency: fiatCurrency } =
      await this.#snapClient.getPreferences();

    const feeEstimates = await this.#chainClient.getFeeEstimates(
      account.network,
    );

    const currentFeeRate =
      feeEstimates.get(this.#targetBlocksConfirmation) ?? this.#fallbackFeeRate;

    templatePsbt.feeRate(currentFeeRate);

    if (amountInSats === account.balance.trusted_spendable.to_sat()) {
      templatePsbt.drainWallet().drainTo(toAddress);
    } else {
      templatePsbt.addRecipient(amountInSats.toString(), toAddress);
    }

    const psbt = templatePsbt.finish();
    const currency = networkToCurrencyUnit[account.network];

    // TODO: add all the necessary properties we need here
    const context: ConfirmSendFormContext = {
      from: account.publicAddress.toString(),
      explorerUrl: this.#chainClient.getExplorerUrl(account.network),
      amount: amountInSats.toString(),
      recipient: toAddress,
      psbt: psbt.toString(),
      currency,
      exchangeRate: await this.#getExchangeRate(account.network, fiatCurrency),
      network: account.network,
      locale,
    };

    const interfaceId =
      await this.#sendFlowRepository.insertConfirmSendForm(context);

    // Blocks and waits for user actions.
    const confirmed =
      await this.#snapClient.displayConfirmation<boolean>(interfaceId);

    if (!confirmed) {
      throw new UserActionError('User canceled the confirmation');
    }

    // sign and broadcast
    const signedPsbt = (
      await this.#accountUseCases.signPsbt(
        account.id,
        psbt,
        'metamask',
        {
          fill: false,
          broadcast: true,
        },
        currentFeeRate,
      )
    ).psbt;

    const parsedPsbt = parsePsbt(signedPsbt);
    return account.extractTransaction(parsedPsbt);
  }

  async display(accountId: string): Promise<Psbt | undefined> {
    this.#logger.debug('Displaying Send form. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new NotFoundError('Account not found');
    }

    const { locale } = await this.#snapClient.getPreferences();

    const context: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      currency: networkToCurrencyUnit[account.network],
      account: {
        id: account.id,
        address: account.publicAddress.toString(), // FIXME: Address should not be needed in the send flow
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
      return undefined;
    }

    this.#logger.info('PSBT generated successfully');
    return Psbt.from_string(psbt);
  }

  async onChangeForm(
    id: string,
    event: SendFormEvent,
    context: SendFormContext,
    value?: InputChangeEvent['value'],
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
        return this.#handleSetRecipient(id, context, value as string);
      }
      case SendFormEvent.Amount: {
        return this.#handleSetAmount(id, context, value as string);
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
        return this.#handleSetAccount(
          id,
          context,
          value as SetAccountEventValue,
        );
      }
      case SendFormEvent.Asset: {
        // Do nothing as there are no other assets
        return undefined;
      }
      default:
        throw new UserActionError('Unrecognized event');
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
        throw new UserActionError('Unrecognized event');
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

  async #getExchangeRate(
    network: Network,
    currency: string,
  ): Promise<CurrencyRate | undefined> {
    // Exchange rate is only relevant for Bitcoin
    if (network === 'bitcoin') {
      const spotPrice = await this.#ratesClient.spotPrices(currency);
      return {
        conversionRate: spotPrice.price,
        conversionDate: getCurrentUnixTimestamp(),
        currency: currency.toUpperCase(),
      };
    }

    return undefined;
  }

  async #handleSetRecipient(
    id: string,
    context: SendFormContext,
    formState: string,
  ): Promise<void> {
    let updatedContext = { ...context };
    delete updatedContext.errors.recipient;
    delete updatedContext.errors.tx;

    try {
      updatedContext.recipient = Address.from_string(
        formState,
        context.network,
      ).toString();
      updatedContext = await this.#computeFee(updatedContext);
    } catch (error) {
      this.#logger.error(
        `Invalid recipient. Error: %s`,
        (error as CodifiedError).message,
      );

      updatedContext.errors = {
        ...updatedContext.errors,
        recipient: error as CodifiedError,
      };
    }

    return await this.#sendFlowRepository.updateForm(id, updatedContext);
  }

  async #handleSetAmount(
    id: string,
    context: SendFormContext,
    formState: string,
  ): Promise<void> {
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
          (Number(formState) * 1e8) / context.exchangeRate.conversionRate,
        );
        amount = Amount.from_sat(BigInt(sats));
      } else {
        // expects values to be entered in BTC and not satoshis
        amount = Amount.from_btc(Number(formState));
      }

      updatedContext.amount = amount.to_sat().toString();
      updatedContext = await this.#computeFee(updatedContext);
    } catch (error) {
      this.#logger.error(
        `Invalid amount. Error: %s`,
        (error as CodifiedError).message,
      );

      updatedContext.errors = {
        ...updatedContext.errors,
        amount: error as CodifiedError,
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
        throw new NotFoundError('Account removed while confirming send flow');
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

      try {
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
      } catch (error) {
        this.#logger.error(
          `Failed to build PSBT on Confirm. Error: %s`,
          (error as CodifiedError).message,
        );

        const errContext = {
          ...context,
          errors: {
            ...context.errors,
            tx: error as CodifiedError,
          },
        };
        return await this.#sendFlowRepository.updateForm(id, errContext);
      }
    }

    throw new AssertionError('Inconsistent Send form context');
  }

  async #handleSetAccount(
    id: string,
    context: SendFormContext,
    formState: SetAccountEventValue,
  ): Promise<void> {
    const account = await this.#accountRepository.get(formState.accountId);
    if (!account) {
      throw new NotFoundError('Account not found when switching', {
        id: formState.accountId,
      });
    }

    // We "reset" the context with the new account
    const newContext: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      account: {
        id: account.id,
        address: account.publicAddress.toString(), // FIXME: Address should not be needed in the send flow
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
    try {
      const context = await this.#sendFlowRepository.getContext(id);
      return this.#refreshRates(id, context);
    } catch (error) {
      // We do not throw as this is probably due to a scheduled event executing after the interface has been removed.
      this.#logger.debug('Context not found in send flow:', id, error);
      return undefined;
    }
  }

  async #refreshRates(id: string, context: SendFormContext): Promise<void> {
    const { network } = context;
    let updatedContext = { ...context };

    const { locale, currency } = await this.#snapClient.getPreferences();

    try {
      const feeEstimates = await this.#chainClient.getFeeEstimates(network);

      updatedContext.feeRate =
        feeEstimates.get(this.#targetBlocksConfirmation) ??
        this.#fallbackFeeRate;

      updatedContext.exchangeRate = await this.#getExchangeRate(
        network,
        currency,
      );
      updatedContext = await this.#computeFee(updatedContext);
    } catch (error) {
      // We do not throw so we can reschedule. Previous fetched values or fallbacks will be used.
      this.#logger.warn(
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
      const { id } = context.account;
      const account = await this.#accountRepository.get(id);
      if (!account) {
        throw new NotFoundError('Account removed while sending', { id });
      }
      const frozenUTXOs = await this.#accountRepository.getFrozenUTXOs(id);

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
        this.#logger.error(
          `Failed to build PSBT. Error: %s`,
          (error as CodifiedError).message,
        );

        return {
          ...context,
          errors: {
            ...context.errors,
            tx: error as CodifiedError,
          },
        };
      }
    }

    return context;
  }
}
