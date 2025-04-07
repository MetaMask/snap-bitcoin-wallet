import { BtcScope, MetaMaskOptionsStruct } from '@metamask/keyring-api';
import type {
  Keyring,
  KeyringAccount,
  KeyringResponse,
  Balance,
  CaipAssetType,
  CaipAssetTypeOrId,
  Paginated,
  Transaction,
  Pagination,
  MetaMaskOptions,
} from '@metamask/keyring-api';
import type { Json } from '@metamask/utils';
import { assert, boolean, enums, object, optional, string } from 'superstruct';

import { networkToCurrencyUnit } from '../entities';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import {
  networkToCaip19,
  Caip2AddressType,
  caip2ToAddressType,
  caip2ToNetwork,
  networkToCaip2,
} from './caip';
import { mapToKeyringAccount, mapToTransaction } from './mappings';

export const CreateAccountRequest = object({
  scope: enums(Object.values(BtcScope)),
  addressType: optional(enums(Object.values(Caip2AddressType))),
  entropySource: optional(string()),
  accountNameSuggestion: optional(string()),
  synchronize: optional(boolean()),
  ...MetaMaskOptionsStruct.schema,
});

export class KeyringHandler implements Keyring {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    const accounts = await this.#accountsUseCases.list();
    return accounts.map(mapToKeyringAccount);
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    const account = await this.#accountsUseCases.get(id);
    return mapToKeyringAccount(account);
  }

  async createAccount(
    opts: Record<string, Json> & MetaMaskOptions,
  ): Promise<KeyringAccount> {
    assert(opts, CreateAccountRequest);

    const account = await this.#accountsUseCases.create(
      caip2ToNetwork[opts.scope],
      opts.entropySource,
      opts.addressType ? caip2ToAddressType[opts.addressType] : undefined,
      opts.metamask?.correlationId,
    );

    if (opts.synchronize) {
      await this.#accountsUseCases.fullScan(account);
    }

    return mapToKeyringAccount(account);
  }

  async getAccountBalances(
    id: string,
  ): Promise<Record<CaipAssetType, Balance>> {
    const account = await this.#accountsUseCases.get(id);
    const balance = account.balance.trusted_spendable.to_btc().toString();

    return {
      [networkToCaip19[account.network]]: {
        amount: balance,
        unit: networkToCurrencyUnit[account.network],
      },
    };
  }

  async filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    const account = await this.#accountsUseCases.get(id);
    const accountChain = networkToCaip2[account.network];
    return chains.includes(accountChain) ? [accountChain] : [];
  }

  async updateAccount(): Promise<void> {
    throw new Error('Method not supported.');
  }

  async deleteAccount(id: string): Promise<void> {
    await this.#accountsUseCases.delete(id);
  }

  async listAccountAssets(id: string): Promise<CaipAssetTypeOrId[]> {
    const account = await this.#accountsUseCases.get(id);
    return [networkToCaip19[account.network]];
  }

  async listAccountTransactions(
    id: string,
    { limit, next }: Pagination,
  ): Promise<Paginated<Transaction>> {
    const account = await this.#accountsUseCases.get(id);
    const transactions = account.listTransactions();

    // Find starting index based on provided cursor
    let startIndex = 0;
    if (next) {
      const cursorIndex = transactions.findIndex(
        (tx) => tx.txid.toString() === next,
      );
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const paginatedTxs = transactions.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < transactions.length
        ? paginatedTxs[paginatedTxs.length - 1].txid.toString()
        : null;

    return {
      data: paginatedTxs.map((tx) => mapToTransaction(account, tx)),
      next: nextCursor,
    };
  }

  async submitRequest(): Promise<KeyringResponse> {
    throw new Error('Method not implemented.');
  }
}
