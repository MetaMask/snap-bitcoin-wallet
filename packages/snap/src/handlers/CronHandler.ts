import type { Json } from '@metamask/utils';

import type { SendFormContext } from '../entities';
import { SENDFORM_REFRESH_RATE_METHOD, SendFormEvent } from '../entities';
import type { SendFlowUseCases } from '../use-cases';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  readonly #sendFlowUseCases: SendFlowUseCases;

  constructor(accounts: AccountUseCases, sendFlow: SendFlowUseCases) {
    this.#accountsUseCases = accounts;
    this.#sendFlowUseCases = sendFlow;
  }

  async route(method: string, params: Record<string, Json>): Promise<void> {
    switch (method) {
      case 'synchronizeAccounts': {
        return this.#accountsUseCases.synchronizeAll();
      }
      case SENDFORM_REFRESH_RATE_METHOD: {
        return this.#sendFlowUseCases.updateForm(
          params.interfaceId as string,
          SendFormEvent.RefreshRates,
          params.context as SendFormContext,
        );
      }
      default:
        throw new Error('Method not found.');
    }
  }
}
