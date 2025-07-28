import type { JsonRpcRequest } from '@metamask/utils';
import { assert, object, string } from 'superstruct';

import { InexistentMethodError, type Logger } from '../entities';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';

export enum CronMethod {
  SynchronizeAccounts = 'synchronizeAccounts',
  RefreshRates = 'refreshRates',
}

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

  async route(request: JsonRpcRequest): Promise<void> {
    const { method, params } = request;

    switch (method as CronMethod) {
      case CronMethod.SynchronizeAccounts: {
        return this.synchronizeAccounts();
      }
      case CronMethod.RefreshRates: {
        assert(params, SendFormRefreshRatesRequest);
        return this.#sendFlowUseCases.refresh(params.interfaceId);
      }
      default:
        throw new InexistentMethodError(`Method not found: ${method}`);
    }
  }

  async synchronizeAccounts(): Promise<void> {
    const accounts = await this.#accountsUseCases.list();
    const results = await Promise.allSettled(
      accounts.map(async (account) => {
        return this.#accountsUseCases.synchronize(account, 'cron');
      }),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.#logger.error(
          `Account failed to sync. ID: %s. Error: %s`,
          accounts[index]?.id,
          result.reason,
        );
      }
    });
  }
}
