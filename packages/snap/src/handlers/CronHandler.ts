import type { AccountUseCases } from '../use-cases/AccountUseCases';

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(method: string): Promise<void> {
    switch (method) {
      case 'synchronize': {
        return await this.#accountsUseCases.synchronizeAll();
      }
      default:
        throw new Error('Method not found.');
    }
  }
}
