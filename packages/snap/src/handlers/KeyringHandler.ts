import type { AddressType } from '@metamask/bitcoindevkit';
import {
  BtcAccountType,
  BtcScope,
  CreateAccountRequestStruct,
  DeleteAccountRequestStruct,
  DiscoverAccountsRequestStruct,
  FilterAccountChainsStruct,
  GetAccountBalancesRequestStruct,
  GetAccountRequestStruct,
  KeyringRpcMethod,
  ListAccountAssetsRequestStruct,
  ListAccountsRequestStruct,
  ListAccountTransactionsRequestStruct,
  MetaMaskOptionsStruct,
  ResolveAccountAddressRequestStruct,
  SetSelectedAccountsRequestStruct,
  SubmitRequestRequestStruct,
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
  KeyringRequest,
  ResolvedAccountAddress,
} from '@metamask/keyring-api';
import type { CaipChainId, Json, JsonRpcRequest } from '@metamask/snaps-sdk';
import {
  assert,
  boolean,
  enums,
  number,
  object,
  optional,
  string,
} from 'superstruct';

import type { BitcoinAccount, Logger, SnapClient } from '../entities';
import {
  FormatError,
  InexistentMethodError,
  networkToCurrencyUnit,
  Purpose,
  purposeToAddressType,
} from '../entities';
import {
  networkToCaip19,
  caipToAddressType,
  scopeToNetwork,
  networkToScope,
  NetworkStruct,
} from './caip';
import { CronMethod } from './CronHandler';
import {
  BtcWalletRequestStruct,
  type KeyringRequestHandler,
} from './KeyringRequestHandler';
import {
  mapToDiscoveredAccount,
  mapToKeyringAccount,
  mapToTransaction,
} from './mappings';
import { validateSelectedAccounts } from './validation';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { runSnapActionSafely } from '../utils/snapHelpers';

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

  readonly #keyringRequest: KeyringRequestHandler;

  readonly #defaultAddressType: AddressType;

  readonly #snapClient: SnapClient;

  readonly #logger: Logger;

  constructor(
    keyringRequest: KeyringRequestHandler,
    accounts: AccountUseCases,
    defaultAddressType: AddressType,
    snapClient: SnapClient,
    logger: Logger,
  ) {
    this.#keyringRequest = keyringRequest;
    this.#accountsUseCases = accounts;
    this.#defaultAddressType = defaultAddressType;
    this.#snapClient = snapClient;
    this.#logger = logger;
  }

  async route(request: JsonRpcRequest): Promise<Json> {
    switch (request.method) {
      case `${KeyringRpcMethod.ListAccounts}`: {
        assert(request, ListAccountsRequestStruct);
        return this.listAccounts();
      }
      case `${KeyringRpcMethod.GetAccount}`: {
        assert(request, GetAccountRequestStruct);
        return this.getAccount(request.params.id);
      }
      case `${KeyringRpcMethod.CreateAccount}`: {
        assert(request, CreateAccountRequestStruct);
        return this.createAccount(request.params.options);
      }
      case `${KeyringRpcMethod.DiscoverAccounts}`: {
        assert(request, DiscoverAccountsRequestStruct);
        return this.discoverAccounts(
          request.params.scopes as BtcScope[],
          request.params.entropySource,
          request.params.groupIndex,
        );
      }
      case `${KeyringRpcMethod.ListAccountTransactions}`: {
        assert(request, ListAccountTransactionsRequestStruct);
        return this.listAccountTransactions(
          request.params.id,
          request.params.pagination,
        );
      }
      case `${KeyringRpcMethod.ListAccountAssets}`: {
        assert(request, ListAccountAssetsRequestStruct);
        return this.listAccountAssets(request.params.id);
      }
      case `${KeyringRpcMethod.GetAccountBalances}`: {
        assert(request, GetAccountBalancesRequestStruct);
        return this.getAccountBalances(request.params.id);
      }
      case `${KeyringRpcMethod.FilterAccountChains}`: {
        assert(request, FilterAccountChainsStruct);
        return this.filterAccountChains(
          request.params.id,
          request.params.chains,
        );
      }
      case `${KeyringRpcMethod.DeleteAccount}`: {
        assert(request, DeleteAccountRequestStruct);
        await this.deleteAccount(request.params.id);
        return null;
      }
      case `${KeyringRpcMethod.SubmitRequest}`: {
        assert(request, SubmitRequestRequestStruct);
        return this.submitRequest(request.params);
      }
      case `${KeyringRpcMethod.SetSelectedAccounts}`: {
        assert(request, SetSelectedAccountsRequestStruct);
        await this.setSelectedAccounts(request.params.accounts);
        return null;
      }
      case `${KeyringRpcMethod.ResolveAccountAddress}`: {
        assert(request, ResolveAccountAddressRequestStruct);
        return this.resolveAccountAddress(
          request.params.scope,
          request.params.request,
        );
      }

      default: {
        throw new InexistentMethodError('Keyring method not supported', {
          method: request.method,
        });
      }
    }
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    const accounts = await this.#accountsUseCases.list();
    return accounts.map(mapToKeyringAccount);
  }

  async getAccount(id: string): Promise<KeyringAccount> {
    const account = await this.#accountsUseCases.get(id);
    return mapToKeyringAccount(account);
  }

  async createAccount(
    options: Record<string, Json> & MetaMaskOptions,
  ): Promise<KeyringAccount> {
    assert(options, CreateAccountRequest);

    const traceName = 'Create Bitcoin Account';
    let traceStarted = false;

    try {
      await runSnapActionSafely(
        async () => {
          await this.#snapClient.startTrace(traceName);
          traceStarted = true;
        },
        this.#logger,
        'startTrace',
      );

      const {
        metamask,
        scope,
        entropySource = 'm',
        index,
        derivationPath,
        addressType,
        synchronize = false,
        accountNameSuggestion,
      } = options;

      let resolvedIndex = derivationPath
        ? this.#extractAccountIndex(derivationPath)
        : index;

      let resolvedAddressType: AddressType;
      if (addressType) {
        // only support P2WPKH addresses for v1
        if (addressType !== BtcAccountType.P2wpkh) {
          throw new FormatError(
            'Only native segwit (P2WPKH) addresses are supported',
          );
        }
        resolvedAddressType = caipToAddressType[addressType];

        // if both addressType and derivationPath are provided, validate they match
        if (derivationPath) {
          const pathAddressType = this.#extractAddressType(derivationPath);
          if (pathAddressType !== resolvedAddressType) {
            throw new FormatError('Address type and derivation path mismatch');
          }
        }
      } else if (derivationPath) {
        resolvedAddressType = this.#extractAddressType(derivationPath);
      } else {
        resolvedAddressType = this.#defaultAddressType;
        // validate default address type is P2WPKH just to be sure
        if (resolvedAddressType !== 'p2wpkh') {
          throw new FormatError(
            'Only native segwit (P2WPKH) addresses are supported',
          );
        }
      }

      // FIXME: This if should be removed ASAP as the index should always be defined or be 0
      // The Snap automatically increasing the index per request creates significant issues
      // such as: concurrency, lack of idempotency, dangling state (if MM crashes before saving the account), etc.
      if (resolvedIndex === undefined || resolvedIndex === null) {
        const accounts = (await this.#accountsUseCases.list()).filter(
          (acc) =>
            acc.entropySource === entropySource &&
            acc.network === scopeToNetwork[scope] &&
            acc.addressType === resolvedAddressType,
        );

        resolvedIndex = this.#getLowestUnusedIndex(accounts);
      }

      const account = await this.#accountsUseCases.create({
        network: scopeToNetwork[scope],
        entropySource,
        index: resolvedIndex,
        addressType: resolvedAddressType,
        correlationId: metamask?.correlationId,
        synchronize,
        accountName: accountNameSuggestion,
      });

      return mapToKeyringAccount(account);
    } finally {
      if (traceStarted) {
        await runSnapActionSafely(
          async () => this.#snapClient.endTrace(traceName),
          this.#logger,
          'endTrace',
        );
      }
    }
  }

  async discoverAccounts(
    scopes: BtcScope[],
    entropySource: string,
    groupIndex: number,
  ): Promise<DiscoveredAccount[]> {
    const accounts = await Promise.all(
      scopes.flatMap((scope) =>
        // only discover P2WPKH addresses
        [BtcAccountType.P2wpkh].map(async (addressType) =>
          this.#accountsUseCases.discover({
            network: scopeToNetwork[scope],
            entropySource,
            index: groupIndex,
            addressType: caipToAddressType[addressType],
          }),
        ),
      ),
    );

    // Return only accounts with history.
    return accounts
      .filter((account) => account.listTransactions().length > 0)
      .map(mapToDiscoveredAccount);
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
    throw new InexistentMethodError('Method not supported.');
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

  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    return this.#keyringRequest.route(request);
  }

  async setSelectedAccounts(accounts: string[]): Promise<void> {
    const accountIdSet = new Set(accounts);
    const allAccounts = await this.#accountsUseCases.list();

    validateSelectedAccounts(
      accountIdSet,
      allAccounts.map((acc) => acc.id),
    );

    // Schedule immediate background job to perform full scan
    await this.#snapClient.scheduleBackgroundEvent({
      duration: 'PT1S',
      method: CronMethod.SyncSelectedAccounts,
      params: { accountIds: accounts },
    });
  }

  /**
   * Resolves the address of an account from a signing request.
   *
   * This is required by the routing system of MetaMask to dispatch
   * incoming non-EVM dapp signing requests.
   *
   * @param scope - Request's scope (CAIP-2).
   * @param request - Signing request object.
   * @returns A Promise that resolves to the account address that must
   * be used to process this signing request, or null if none candidates
   * could be found.
   */
  async resolveAccountAddress(
    scope: CaipChainId,
    request: JsonRpcRequest,
  ): Promise<ResolvedAccountAddress | null> {
    try {
      assert(scope, NetworkStruct);
      const { method, params } = request;

      const requestWithoutCommonHeader = { method, params };
      assert(requestWithoutCommonHeader, BtcWalletRequestStruct);

      const allAccounts = await this.listAccounts();

      const caip10Address = this.#keyringRequest.resolveAccountAddress(
        allAccounts,
        scope,
        requestWithoutCommonHeader,
      );

      return { address: caip10Address };
    } catch (error: unknown) {
      this.#logger.error({ error }, 'Error resolving account address');
      return null;
    }
  }

  #extractAddressType(path: string): AddressType {
    const segments = path.split('/');
    if (segments.length < 4) {
      throw new FormatError(`Invalid derivation path: ${path}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const purposePart = segments[1]!;
    const match = purposePart.match(/^(\d+)/u);
    if (!match) {
      throw new FormatError(`Invalid purpose segment: ${purposePart}`);
    }

    const purpose = Number(match[1]);
    if (!Object.values(Purpose).includes(purpose)) {
      throw new FormatError(`Invalid BIP-purpose: ${purpose}`);
    }

    // only support native segwit (BIP-84) derivation paths for now
    if ((purpose as Purpose) !== Purpose.NativeSegwit) {
      throw new FormatError(
        `Only native segwit (BIP-84) derivation paths are supported`,
      );
    }

    const addressType = purposeToAddressType[purpose as Purpose];
    if (!addressType) {
      throw new FormatError(`No address-type mapping for purpose: ${purpose}`);
    }

    return addressType;
  }

  #extractAccountIndex(path: string): number {
    const segments = path.split('/');
    if (segments.length < 4) {
      throw new FormatError(`Invalid derivation path: ${path}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const accountPart = segments[3]!;
    const match = accountPart.match(/^(\d+)/u);
    if (!match) {
      throw new FormatError(`Invalid account index: ${accountPart}`);
    }

    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 0) {
      throw new FormatError(
        `Account index must be a non-negative integer, got: ${index}`,
      );
    }

    return index;
  }

  #getLowestUnusedIndex(accounts: BitcoinAccount[]): number {
    if (accounts.length === 0) {
      return 0;
    }

    const usedIndices = accounts
      .map((acc) => acc.accountIndex)
      .sort((idxA, idxB) => idxA - idxB);

    let lowestUnusedIndex = 0;

    for (const usedIndex of usedIndices) {
      /**
       * From lower to higher, the moment we find a gap, we can use it
       */
      if (usedIndex !== lowestUnusedIndex) {
        break;
      }

      lowestUnusedIndex += 1;
    }

    return lowestUnusedIndex;
  }
}
