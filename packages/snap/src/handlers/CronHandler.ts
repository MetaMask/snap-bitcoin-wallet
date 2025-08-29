import type { JsonRpcRequest } from '@metamask/utils';
import { assert, object, string } from 'superstruct';

import {
  InexistentMethodError,
  type SnapClient,
  SynchronizationError,
} from '../entities';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';

export enum CronMethod {
  SynchronizeAccounts = 'synchronizeAccounts',
  RefreshRates = 'refreshRates',
}

export const SendFormRefreshRatesRequest = object({
  interfaceId: string(),
});

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  readonly #sendFlowUseCases: SendFlowUseCases;

  readonly #snapClient: SnapClient;

  constructor(
    accounts: AccountUseCases,
    sendFlow: SendFlowUseCases,
    snapClient: SnapClient,
  ) {
    this.#accountsUseCases = accounts;
    this.#sendFlowUseCases = sendFlow;
    this.#snapClient = snapClient;
  }

  async route(request: JsonRpcRequest): Promise<void> {
    const { method, params } = request;

    const { active } = await this.#snapClient.getClientStatus();
    if (!active) {
      return undefined;
    }

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

    const errors: Record<string, any> = {};
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const id = accounts[index]?.id;
        if (id) {
          errors[id] = result.reason;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      throw new SynchronizationError(
        'Account synchronization failures',
        errors,
      );
    }
  }
}
