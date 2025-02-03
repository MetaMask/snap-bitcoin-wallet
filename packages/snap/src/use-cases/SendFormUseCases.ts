import { UserRejectedRequestError } from '@metamask/snaps-sdk';

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
    logger.debug('Executing Send flow. Account: %s', accountId);

    const account = await this.#accountRepository.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const currency = networkToCurrencyUnit[account.network];
    const formContext: SendFormContext = {
      currency,
      account: account.id,
    };

    // TODO: Move rate fetching to cron job
    // Only get the rate when on mainnet as other currencies have no exchange value
    if (currency === CurrencyUnit.Bitcoin) {
      formContext.fiatRate = await this.#snapClient.getBtcRate();
    }

    const formId = await this.#sendFormRepository.insert(account, formContext);

    // Blocks and waits for user actions
    const request = await this.#snapClient.displayInterface<TransactionRequest>(
      formId,
    );

    if (!request) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    logger.info('Bitcoin Send flow executed successfully: %s', formId);
    return request;
  }

  async update(
    id: string,
    event: SendFormEvent,
    context: SendFormContext,
  ): Promise<void> {
    logger.trace('Updating Send form. ID: %s. Event: %s', id, event);

    const account = await this.#accountRepository.get(context.account);
    if (!account) {
      logger.warn('Missing account in Send form. ID: %s', context.account);
      return await this.#snapClient.resolveInterface(id, null);
    }

    switch (event) {
      case SendFormEvent.HeaderBack:
      case SendFormEvent.Cancel: {
        return await this.#snapClient.resolveInterface(id, null);
      }
      case SendFormEvent.Clear: {
        const updatedContext = { ...context, recipient: '' };
        return await this.#sendFormRepository.update(
          id,
          account,
          updatedContext,
        );
      }
      case SendFormEvent.SwapCurrency: {
        context.currency =
          context.currency === CurrencyUnit.Bitcoin
            ? CurrencyUnit.Fiat
            : CurrencyUnit.Bitcoin;
        return await this.#sendFormRepository.update(id, account, context);
      }
      case SendFormEvent.Review: {
        // TODO: Implement confirmation screen
        console.log('display confirmation form');
        // await displayConfirmationReview({ request: context.request });
        return Promise.resolve();
      }
      case SendFormEvent.SetMax: {
        const updatedContext = {
          ...context,
          amount: account.balance.trusted_spendable.to_sat().toString(),
        };
        return await this.#sendFormRepository.update(
          id,
          account,
          updatedContext,
        );
      }
      default:
        return Promise.resolve();
    }
  }
}
