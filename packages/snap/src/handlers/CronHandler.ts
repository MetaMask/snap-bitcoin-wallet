import type { JsonRpcParams } from '@metamask/utils';
import { assert, object, string } from 'superstruct';

import { SendFormEvent } from '../entities';
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
        return this.#accountsUseCases.synchronizeAll();
      }
      case SendFormEvent.RefreshRates: {
        assert(params, SendFormRefreshRatesRequest);
        return this.#sendFlowUseCases.refreshRates(params.interfaceId);
      }
      default:
        throw new Error('Method not found.');
    }
  }
}
