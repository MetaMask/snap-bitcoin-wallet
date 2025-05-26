import type { AddressType } from '@metamask/bitcoindevkit';
import {
  BtcAccountType,
  BtcScope,
  MetaMaskOptionsStruct,
} from '@metamask/keyring-api';
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
  DiscoveredAccount,
} from '@metamask/keyring-api';
import { handleKeyringRequest } from '@metamask/keyring-snap-sdk';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import {
  assert,
  boolean,
  enums,
  number,
  object,
  optional,
  string,
} from 'superstruct';

import type { SnapClient } from '../entities';
import {
  networkToCurrencyUnit,
  Purpose,
  purposeToAddressType,
} from '../entities';
import {
  networkToCaip19,
  caipToAddressType,
  scopeToNetwork,
  networkToScope,
} from './caip';
import { handle } from './errors';
import {
  mapToDiscoveredAccount,
  mapToKeyringAccount,
  mapToTransaction,
} from './mappings';
import { validateOrigin } from './permissions';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

export const CreateAccountRequest = object({
  scope: enums(Object.values(BtcScope)),
  addressType: optional(enums(Object.values(BtcAccountType))),
  entropySource: optional(string()),
  accountNameSuggestion: optional(string()),
  synchronize: optional(boolean()),
  index: optional(number()),
  derivationPath: optional(string()),
  ...MetaMaskOptionsStruct.schema,
});

export class KeyringHandler implements Keyring {
  readonly #accountsUseCases: AccountUseCases;

  readonly #snapClient: SnapClient;

  constructor(accounts: AccountUseCases, snapClient: SnapClient) {
    this.#accountsUseCases = accounts;
    this.#snapClient = snapClient;
  }

  async route(origin: string, request: JsonRpcRequest): Promise<Json> {
    validateOrigin(origin);

    const result = await handle(async () =>
      handleKeyringRequest(this, request),
    );

    return result ?? null; // Use `null` since `undefined` is not valid in JSON.
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
    options: Record<string, Json> & MetaMaskOptions,
  ): Promise<KeyringAccount> {
    assert(options, CreateAccountRequest);
    const {
      metamask,
      scope,
      entropySource,
      index,
      derivationPath,
      addressType,
      synchronize,
    } = options;

    const resolvedIndex = derivationPath
      ? this.#extractAccountIndex(derivationPath)
      : index;

    let resolvedAddressType: AddressType | undefined;
    if (addressType) {
      resolvedAddressType = caipToAddressType[addressType];
    } else if (derivationPath) {
      resolvedAddressType = this.#extractAddressType(derivationPath);
    }

    const createParams = {
      network: scopeToNetwork[scope],
      entropySource,
      index: resolvedIndex,
      addressType: resolvedAddressType,
      synchronize,
    };
    const account = await this.#accountsUseCases.create(createParams);

    await this.#snapClient.emitAccountCreatedEvent(
      account,
      metamask?.correlationId,
    );

    if (synchronize) {
      await this.#accountsUseCases.fullScan(account);
    }

    return mapToKeyringAccount(account);
  }

  async discoverAccounts(
    scopes: BtcScope[],
    entropySource: string,
    groupIndex: number,
  ): Promise<DiscoveredAccount[]> {
    // Discovery is essentially the same as batch creation with synchronization, but without emitting events.
    // Accounts are unique per network and address type.

    const accounts = await Promise.all(
      scopes.flatMap((scope) =>
        Object.values(BtcAccountType).map(async (addressType) => {
          const createParams = {
            network: scopeToNetwork[scope],
            entropySource,
            index: groupIndex,
            addressType: caipToAddressType[addressType],
            synchronize: true,
          };

          const account = await this.#accountsUseCases.create(createParams);
          await this.#accountsUseCases.fullScan(account);
          return account;
        }),
      ),
    );

    // Return only accounts with history (even if balance is 0).
    return accounts
      .filter((account) => account.listTransactions().length > 0)
      .map((account) => mapToDiscoveredAccount(account, groupIndex));
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
    const accountChain = networkToScope[account.network];
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
    const hasMore = startIndex + limit < transactions.length;
    const nextCursor =
      hasMore && paginatedTxs.length > 0
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          paginatedTxs[paginatedTxs.length - 1]!.txid.toString()
        : null;

    return {
      data: paginatedTxs.map((tx) => mapToTransaction(account, tx)),
      next: nextCursor,
    };
  }

  async submitRequest(): Promise<KeyringResponse> {
    throw new Error('Method not implemented.');
  }

  #extractAddressType(path: string): AddressType {
    const segments = path.split('/');
    if (segments.length < 4) {
      throw new Error(`Invalid derivation path: ${path}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const purposePart = segments[1]!;
    const match = purposePart.match(/^(\d+)/u);
    if (!match) {
      throw new Error(`Invalid purpose segment: ${purposePart}`);
    }

    const purpose = Number(match[1]);
    if (!Object.values(Purpose).includes(purpose)) {
      throw new Error(`Invalid BIP-purpose: ${purpose}`);
    }

    const addressType = purposeToAddressType[purpose as Purpose];
    if (!addressType) {
      throw new Error(`No address-type mapping for purpose: ${purpose}`);
    }

    return addressType;
  }

  #extractAccountIndex(path: string): number {
    const segments = path.split('/');
    if (segments.length < 4) {
      throw new Error(`Invalid derivation path: ${path}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const accountPart = segments[3]!;
    const match = accountPart.match(/^(\d+)/u);
    if (!match) {
      throw new Error(`Invalid account index: ${accountPart}`);
    }

    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(
        `Account index must be a non-negative integer, got: ${index}`,
      );
    }

    return index;
  }
}
