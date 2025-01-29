import type { AccountUseCases } from '../use-cases/AccountUseCases';

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(method: string): Promise<void> {
    switch (method) {
      case 'synchronize': {
        // accounts cannot be empty by assertion.
        const accounts = await this.#accountsUseCases.list();
        await Promise.all(
          accounts.map(async (account) =>
            this.#accountsUseCases.synchronize(account.id),
          ),
        );
        return;
      }
      default:
        throw new Error('Method not found.');
    }
  }
}
