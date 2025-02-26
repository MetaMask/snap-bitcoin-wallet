import { SendFlowUseCases } from '../use-cases';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { Json } from '@metamask/utils';
import {
  SENDFORM_REFRESH_RATE_METHOD,
  SendFormContext,
  SendFormEvent,
} from '../entities';

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
