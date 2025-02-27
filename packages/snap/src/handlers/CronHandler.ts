import type { JsonRpcParams } from '@metamask/utils';
import { assert, object, string } from 'superstruct';

import { SendFormEvent } from '../entities';
import { logger } from '../infra/logger';
import type { SendFlowUseCases } from '../use-cases';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

export const SendFormRefreshRatesRequest = object({
  interfaceId: string(),
});

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  readonly #sendFlowUseCases: SendFlowUseCases;

  constructor(accounts: AccountUseCases, sendFlow: SendFlowUseCases) {
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
        return this.#sendFlowUseCases.refreshRates(params.interfaceId);
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
        logger.error(
          `Account failed to sync. ID: %s. Error: %o`,
          accounts[index].id,
          result.reason,
        );
      }
    });
  }
}
