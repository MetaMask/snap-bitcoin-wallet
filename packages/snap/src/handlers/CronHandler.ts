import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { logger } from '../utils';

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(method: string): Promise<void> {
    switch (method) {
      case 'synchronize': {
        return await this.#synchronize();
      }
      default:
        throw new Error('Method not found.');
    }
  }

  async #synchronize(): Promise<void> {
    // accounts cannot be empty by assertion.
    const accounts = await this.#accountsUseCases.list();
    const results = await Promise.allSettled(
      accounts.map(async (account) =>
        this.#accountsUseCases.synchronize(account.id),
      ),
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
