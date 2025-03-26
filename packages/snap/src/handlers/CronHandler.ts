import type { JsonRpcParams } from '@metamask/utils';
import { assert, object, string } from 'superstruct';

import type { Logger } from '../entities';
import { SendFormEvent } from '../entities';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';

export const SendFormRefreshRatesRequest = object({
  interfaceId: string(),
});

export class CronHandler {
  readonly #logger: Logger;

  readonly #accountsUseCases: AccountUseCases;

  readonly #sendFlowUseCases: SendFlowUseCases;

  constructor(
    logger: Logger,
    accounts: AccountUseCases,
    sendFlow: SendFlowUseCases,
  ) {
    this.#logger = logger;
    this.#accountsUseCases = accounts;
    this.#sendFlowUseCases = sendFlow;
  }

  async route(method: string, params?: JsonRpcParams): Promise<void> {
    switch (method) {
      case 'synchronizeAccounts': {
        return this.synchronizeAccounts();
      }
      case SendFormEvent.RefreshRates: {
        assert(params, SendFormRefreshRatesRequest);
        return this.#sendFlowUseCases.onChangeForm(
          params.interfaceId,
          SendFormEvent.RefreshRates,
        );
      }
      default:
        throw new Error('Method not found.');
    }
  }

  async synchronizeAccounts(): Promise<void> {
    const accounts = await this.#accountsUseCases.list();
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        return this.#accountsUseCases.synchronize(account);
      }),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#logger.error(
          `Account failed to sync. ID: %s. Error: %s`,
          accounts[index].id,
          result.reason,
        );
      }
    });
  }
}
