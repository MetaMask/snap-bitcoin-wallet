import { getSelectedAccounts } from '@metamask/keyring-snap-sdk';
import type { JsonRpcRequest, SnapsProvider } from '@metamask/snaps-sdk';
import { array, assert, object, string } from 'superstruct';

import {
  InexistentMethodError,
  type SnapClient,
  type SyncResult,
  SynchronizationError,
} from '../entities';
import type { SendFlowUseCases, AccountUseCases } from '../use-cases';

export enum CronMethod {
  SynchronizeAccounts = 'synchronizeAccounts',
  RefreshRates = 'refreshRates',
  SyncSelectedAccounts = 'syncSelectedAccounts',
  FullScanAccount = 'fullScanAccount',
}

export const SendFormRefreshRatesRequest = object({
  interfaceId: string(),
});

export const SyncSelectedAccountsRequest = object({
  accountIds: array(string()),
});

export const FullScanAccountRequest = object({
  accountId: string(),
});

export class CronHandler {
  readonly #accountsUseCases: AccountUseCases;

  readonly #sendFlowUseCases: SendFlowUseCases;

  readonly #snapClient: SnapClient;

  readonly #snap: SnapsProvider;

  constructor(
    accounts: AccountUseCases,
    sendFlow: SendFlowUseCases,
    snapClient: SnapClient,
    snap: SnapsProvider,
  ) {
    this.#accountsUseCases = accounts;
    this.#sendFlowUseCases = sendFlow;
    this.#snapClient = snapClient;
    this.#snap = snap;
  }

  async route(request: JsonRpcRequest): Promise<void> {
    const { method, params } = request;

    const { active, locked } = await this.#snapClient.getClientStatus();
    if (!active || locked) {
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
      case CronMethod.SyncSelectedAccounts: {
        assert(params, SyncSelectedAccountsRequest);
        return this.syncSelectedAccounts(params.accountIds);
      }
      case CronMethod.FullScanAccount: {
        assert(params, FullScanAccountRequest);
        return this.fullScanAccount(params.accountId);
      }
      default:
        throw new InexistentMethodError(`Method not found: ${method}`);
    }
  }

  async synchronizeAccounts(): Promise<void> {
    const selectedAccounts: Set<string> = new Set(
      await getSelectedAccounts(this.#snap),
    );

    const accounts = (await this.#accountsUseCases.list()).filter((account) => {
      return selectedAccounts.has(account.id);
    });

    const results = await Promise.allSettled(
      accounts.map(async (account) =>
        this.#accountsUseCases.synchronize(account, 'cron'),
      ),
    );

    const successfulResults: SyncResult[] = [];

    const errors: Record<string, any> = {};

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        const id = accounts[index]?.id;
        if (id) {
          errors[id] = result.reason;
        }
      }
    });

    await this.#emitSyncEvents(successfulResults);

    if (Object.keys(errors).length > 0) {
      throw new SynchronizationError(
        'Account synchronization failures',
        errors,
      );
    }
  }

  async syncSelectedAccounts(accountIds: string[]): Promise<void> {
    const accountIdSet = new Set(accountIds);
    const allAccounts = await this.#accountsUseCases.list();

    const selectedAccounts = allAccounts.filter((account) =>
      accountIdSet.has(account.id),
    );

    const results = await Promise.allSettled(
      selectedAccounts.map(async (account) =>
        this.#accountsUseCases.synchronize(account, 'metamask'),
      ),
    );

    const successfulResults = results
      .filter(
        (result): result is PromiseFulfilledResult<SyncResult> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);

    await this.#emitSyncEvents(successfulResults);
  }

  /**
   * Emit batched balance and transaction events for sync results.
   *
   * @param results - The successful sync results.
   */
  async #emitSyncEvents(results: SyncResult[]): Promise<void> {
    if (results.length === 0) {
      return;
    }

    // Emit one batched balance event for all accounts
    await this.#snapClient.emitAccountBalancesUpdatedEvent(
      results.map((syncResult) => syncResult.account),
    );

    // Emit transaction events per account
    for (const { account, transactionsToNotify } of results) {
      if (transactionsToNotify.length > 0) {
        await this.#snapClient.emitAccountTransactionsUpdatedEvent(
          account,
          transactionsToNotify,
        );
      }
    }
  }

  async fullScanAccount(accountId: string): Promise<void> {
    const account = await this.#accountsUseCases.get(accountId);
    const result = await this.#accountsUseCases.fullScan(account);

    await this.#emitSyncEvents([result]);
  }
}
