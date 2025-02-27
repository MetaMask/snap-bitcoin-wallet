import { logger } from '../infra/logger';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async route(method: string): Promise<void> {
    switch (method) {
      case 'synchronizeAccounts': {
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
      default:
        throw new Error('Method not found.');
    }
  }
}
