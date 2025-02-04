import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import { Address, Amount } from 'bitcoindevkit';

import type { SendFormContext, TransactionRequest } from '../entities';
import {
  CurrencyUnit,
  networkToCurrencyUnit,
  SendFormEvent,
  type BitcoinAccountRepository,
  type SendFormRepository,
} from '../entities';
import type { SnapClient } from '../entities/snap';
import { logger } from '../utils';

export class SendFormUseCases {
  readonly #snapClient: SnapClient;

  readonly #accountRepository: BitcoinAccountRepository;

  readonly #sendFormRepository: SendFormRepository;

  constructor(
    snapClient: SnapClient,
    accountRepository: BitcoinAccountRepository,
    sendFormrepository: SendFormRepository,
  ) {
    this.#snapClient = snapClient;
    this.#accountRepository = accountRepository;
    this.#sendFormRepository = sendFormrepository;
  }

  async display(accountId: string): Promise<TransactionRequest> {
    logger.debug('Displaying Send form. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const currency = networkToCurrencyUnit[account.network];

    const formContext: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      currency,
      account: account.id,
      network: account.network,
      feeRate: 5, // TODO: Fetch fee rates from state
      errors: {},
    };

    // TODO: Move fiat rate fetching to cron job
    // Only get the rate when on mainnet as other currencies have no exchange value
    if (currency === CurrencyUnit.Bitcoin) {
      formContext.fiatRate = await this.#snapClient.getBtcRate();
    }

    const formId = await this.#sendFormRepository.insert(formContext);

    // Blocks and waits for user actions
    const request = await this.#snapClient.displayInterface<TransactionRequest>(
      formId,
    );
    if (!request) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    logger.info('Send form resolved successfully: %s', formId);
    return request;
  }

  async update(
    id: string,
    event: SendFormEvent,
    context: SendFormContext,
  ): Promise<void> {
    logger.trace('Updating Send form. ID: %s. Event: %s', id, event);

    switch (event) {
      case SendFormEvent.HeaderBack:
      case SendFormEvent.Cancel: {
        return await this.#snapClient.resolveInterface(id, null);
      }
      case SendFormEvent.ClearRecipient: {
        const updatedContext = { ...context };
        delete updatedContext.recipient;
        delete updatedContext.errors.recipient;
        delete updatedContext.errors.tx;
        delete updatedContext.fee;

        return await this.#sendFormRepository.update(id, updatedContext);
      }
      case SendFormEvent.SwapCurrency: {
        context.currency =
          context.currency === CurrencyUnit.Fiat
            ? networkToCurrencyUnit[context.network]
            : CurrencyUnit.Fiat;
        return await this.#sendFormRepository.update(id, context);
      }
      case SendFormEvent.Review: {
        const { amount, feeRate, recipient } = context;
        if (amount && recipient) {
          const txRequest: TransactionRequest = {
            amount,
            recipient,
            feeRate,
          };
          return await this.#snapClient.resolveInterface(id, txRequest);
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
        return Promise.resolve();
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
    return await this.#sendFormRepository.update(id, updatedContext);
  }

  async #handleSetRecipient(
    id: string,
    context: SendFormContext,
  ): Promise<void> {
    const formState = await this.#sendFormRepository.getState(id);

    let updatedContext = { ...context };
    delete updatedContext.errors.recipient;
    delete updatedContext.errors.tx;

    try {
      Address.new(formState.recipient, context.network);
      // TODO: Use address from Address
      updatedContext.recipient = formState.recipient;
      updatedContext = await this.#computeFee(updatedContext);
    } catch (error) {
      updatedContext.errors = {
        ...updatedContext.errors,
        recipient: error instanceof Error ? error.message : String(error),
      };
    }

    return await this.#sendFormRepository.update(id, updatedContext);
  }

  async #handleSetAmount(id: string, context: SendFormContext): Promise<void> {
    const formState = await this.#sendFormRepository.getState(id);

    let updatedContext = { ...context };
    delete updatedContext.errors.amount;
    delete updatedContext.errors.tx;
    delete updatedContext.fee;

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

    return await this.#sendFormRepository.update(id, updatedContext);
  }

  async #computeFee(context: SendFormContext): Promise<SendFormContext> {
    const { amount, recipient, drain } = context;
    if (amount && recipient) {
      const account = await this.#accountRepository.get(context.account);
      if (!account) {
        throw new Error('Account removed while sending');
      }

      try {
        if (drain) {
          const psbt = account.drainTo(context.feeRate, recipient);
          const realAmount = BigInt(amount) - BigInt('1450');
          return { ...context, fee: '1450', amount: realAmount.toString() }; // TODO: Replace this with `psbt.fee()` if available
        }

        const psbt = account.buildTx(context.feeRate, recipient, amount);
        return { ...context, fee: '1450' }; // TODO: Replace this with `psbt.fee()` if available
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
