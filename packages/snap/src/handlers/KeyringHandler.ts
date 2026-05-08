import type { AddressType, Network } from '@metamask/bitcoindevkit';
import {
  AccountCreationType,
  assertCreateAccountOptionIsSupported,
  BtcAccountType,
  BtcScope,
  CreateAccountRequestStruct,
  CreateAccountsRequestStruct,
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
  CreateAccountOptions,
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

import {
  addressTypeToPurpose,
  type AccountState,
  type BitcoinAccount,
  FormatError,
  InexistentMethodError,
  type Logger,
  networkToCoinType,
  networkToCurrencyUnit,
  Purpose,
  purposeToAddressType,
  type SnapClient,
} from '../entities';
import {
  networkToCaip19,
  caipToAddressType,
  scopeToNetwork,
  networkToScope,
  NetworkStruct,
} from './caip';
import { CronMethod } from './CronHandler';
import type { KeyringRequestHandler } from './KeyringRequestHandler';
import {
  mapToDiscoveredAccount,
  mapToKeyringAccount,
  mapToTransaction,
} from './mappings';
import { BtcWalletRequestStruct, validateSelectedAccounts } from './validation';
import type {
  AccountUseCases,
  CreateAccountParams,
} from '../use-cases/AccountUseCases';
import { logExecutionTime } from '../utils/performance';
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

/** Maximum number of accounts to create in one internal createMany call. */
const MAX_CREATE_ACCOUNTS_PER_BATCH = 100;

const MAX_MISSING_INDEXES_TO_LOG = 25;

/**
 * @param operation - Base operation name.
 * @param details - Account creation context to append.
 * @returns Operation name with account creation context.
 */
function formatAccountCreationOperation(
  operation: string,
  details: string,
): string {
  return `${operation} (${details})`;
}

type CreateAccountsStateLogDetails = {
  entropySource: string;
  from: number;
  to: number;
  network: Network;
  addressType: AddressType;
  label: string;
};

/**
 * @param value - JSON value to coerce into an object record.
 * @returns Object record or an empty object.
 */
function getJsonRecord(value: Json | null): Record<string, Json> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, Json>;
}

/**
 * @param accounts - Account state namespace.
 * @returns Non-null account state entries.
 */
function getAccountStateEntries(
  accounts: Json | null,
): [string, AccountState][] {
  return Object.entries(getJsonRecord(accounts)).flatMap(([id, account]) => {
    if (!account || typeof account !== 'object' || Array.isArray(account)) {
      return [];
    }

    return [[id, account as unknown as AccountState]];
  });
}

/**
 * @param derivationPaths - Derivation path state namespace.
 * @returns Derivation path entries whose account IDs are strings.
 */
function getDerivationPathEntries(
  derivationPaths: Json | null,
): [string, string][] {
  return Object.entries(getJsonRecord(derivationPaths)).flatMap(([path, id]) =>
    typeof id === 'string' ? [[path, id]] : [],
  );
}

/**
 * @param derivationPath - Split derivation path.
 * @returns Storage key for a derivation path.
 */
function getDerivationPathKey(derivationPath: string[]): string {
  return derivationPath.join('/');
}

/**
 * @param entropySource - Account entropy source.
 * @param addressType - Account address type.
 * @param network - Bitcoin network.
 * @param index - Account index.
 * @returns Expected derivation path storage key.
 */
function getAccountDerivationPathKey(
  entropySource: string,
  addressType: AddressType,
  network: Network,
  index: number,
): string {
  return [
    entropySource,
    `${addressTypeToPurpose[addressType]}'`,
    `${networkToCoinType[network]}'`,
    `${index}'`,
  ].join('/');
}

/**
 * @param derivationPath - Split derivation path.
 * @returns Account index or null when it cannot be parsed.
 */
function getAccountIndex(derivationPath: string[]): number | null {
  const segment = derivationPath[3];
  if (!segment) {
    return null;
  }

  const numericPart = segment.endsWith("'") ? segment.slice(0, -1) : segment;
  const index = Number(numericPart);
  return Number.isSafeInteger(index) ? index : null;
}

/**
 * @param details - Account creation context.
 * @param state - Snap state snapshot.
 * @param state.root - Root Snap state.
 * @param state.accounts - Account state namespace.
 * @param state.derivationPaths - Derivation-path index namespace.
 * @returns Snapshot verification log line.
 */
function formatCreateAccountsStateLog(
  details: CreateAccountsStateLogDetails,
  state: {
    root: Json | null;
    accounts: Json | null;
    derivationPaths: Json | null;
  },
): string {
  const accountEntries = getAccountStateEntries(state.accounts);
  const accountsById = new Map(accountEntries);
  const derivationPathEntries = getDerivationPathEntries(state.derivationPaths);
  const derivationPathsByPath = new Map(derivationPathEntries);
  const requestedCount = details.to - details.from + 1;
  const missingIndexes: number[] = [];
  let persistedRequestedCount = 0;

  for (let index = details.from; index <= details.to; index += 1) {
    const pathKey = getAccountDerivationPathKey(
      details.entropySource,
      details.addressType,
      details.network,
      index,
    );
    const accountId = derivationPathsByPath.get(pathKey);

    if (accountId && accountsById.has(accountId)) {
      persistedRequestedCount += 1;
    } else if (missingIndexes.length < MAX_MISSING_INDEXES_TO_LOG) {
      missingIndexes.push(index);
    }
  }

  const entropyAccountIndexes = accountEntries
    .flatMap(([, account]) => {
      if (account.derivationPath[0] !== details.entropySource) {
        return [];
      }

      const index = getAccountIndex(account.derivationPath);
      return index === null ? [] : [index];
    })
    .sort((left, right) => left - right);
  const entropyDerivationPathsCount = derivationPathEntries.filter(([path]) =>
    path.startsWith(`${details.entropySource}/`),
  ).length;
  const orphanedDerivationPathCount = derivationPathEntries.filter(
    ([, id]) => !accountsById.has(id),
  ).length;
  const missingDerivationPathIndexCount = accountEntries.filter(
    ([id, account]) =>
      derivationPathsByPath.get(
        getDerivationPathKey(account.derivationPath),
      ) !== id,
  ).length;

  return `[SNAP STATE DEBUG - BITCOIN SNAP] keyring_createAccounts final state (${
    details.label
  }) ${JSON.stringify({
    rootKeys: Object.keys(getJsonRecord(state.root)).sort(),
    accountsCount: accountEntries.length,
    derivationPathsCount: derivationPathEntries.length,
    entropyId: details.entropySource,
    entropyAccountsCount: entropyAccountIndexes.length,
    entropyDerivationPathsCount,
    entropyMinIndex: entropyAccountIndexes[0] ?? null,
    entropyMaxIndex:
      entropyAccountIndexes[entropyAccountIndexes.length - 1] ?? null,
    requestedRange: {
      from: details.from,
      to: details.to,
      count: requestedCount,
      persistedCount: persistedRequestedCount,
      missingCount: requestedCount - persistedRequestedCount,
      missingSample: missingIndexes,
      missingSampleLimit: MAX_MISSING_INDEXES_TO_LOG,
    },
    consistency: {
      orphanedDerivationPathCount,
      missingDerivationPathIndexCount,
    },
  })}`;
}

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
      case `${KeyringRpcMethod.CreateAccounts}`: {
        assert(request, CreateAccountsRequestStruct);
        return this.createAccounts(request.params.options);
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

  async createAccounts(
    options: CreateAccountOptions,
  ): Promise<KeyringAccount[]> {
    const start = Date.now();
    assertCreateAccountOptionIsSupported(options, [
      `${AccountCreationType.Bip44DeriveIndex}`,
      `${AccountCreationType.Bip44DeriveIndexRange}`,
    ]);

    const { entropySource } = options;

    const range =
      options.type === AccountCreationType.Bip44DeriveIndex
        ? { from: options.groupIndex, to: options.groupIndex }
        : options.range;

    if (
      !Number.isSafeInteger(range.from) ||
      !Number.isSafeInteger(range.to) ||
      range.from < 0 ||
      range.to < 0
    ) {
      throw new FormatError(
        'Account index range is invalid: from and to must be non-negative integers',
      );
    }

    if (range.from > range.to) {
      throw new FormatError(
        'Account index range is invalid: from must be less than or equal to to',
      );
    }

    const batchSize = range.to - range.from + 1;
    const indexLabel =
      range.from === range.to ? `${range.from}` : `${range.from}-${range.to}`;
    const accountCreationDetails = `entropyId=${entropySource} indexes=${indexLabel} count=${batchSize}`;

    // Only P2WPKH (BIP-84) on bitcoin mainnet is supported for v1, mirroring
    // the defaults used by `createAccount` when no scope is provided.
    const network = scopeToNetwork[BtcScope.Mainnet];
    const addressType = this.#defaultAddressType;
    const stateLogDetails: CreateAccountsStateLogDetails = {
      entropySource,
      from: range.from,
      to: range.to,
      network,
      addressType,
      label: accountCreationDetails,
    };
    if (addressType !== 'p2wpkh') {
      throw new FormatError(
        'Only native segwit (P2WPKH) addresses are supported',
      );
    }

    const traceName = 'Create Bitcoin Accounts Batch';
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

      // `AccountUseCases.createMany` is idempotent: if an account already exists
      // for the resolved derivation path, it will be returned as-is.
      const createManyStart = Date.now();
      const accounts: BitcoinAccount[] = [];
      let chunkFrom = range.from;

      while (chunkFrom <= range.to) {
        const chunkTo = Math.min(
          chunkFrom + MAX_CREATE_ACCOUNTS_PER_BATCH - 1,
          range.to,
        );
        const chunkSize = chunkTo - chunkFrom + 1;
        const chunkIndexLabel =
          chunkFrom === chunkTo ? `${chunkFrom}` : `${chunkFrom}-${chunkTo}`;
        const chunkDetails = `entropyId=${entropySource} indexes=${chunkIndexLabel} count=${chunkSize}`;
        const chunkRequests: CreateAccountParams[] = [];

        for (let index = chunkFrom; index <= chunkTo; index += 1) {
          chunkRequests.push({
            network,
            entropySource,
            index,
            addressType,
            synchronize: false,
          });
        }

        const createManyChunkStart = Date.now();
        accounts.push(
          ...(await this.#accountsUseCases.createMany(chunkRequests)),
        );
        logExecutionTime(
          formatAccountCreationOperation(
            'keyring_createAccounts createMany batch',
            chunkDetails,
          ),
          createManyChunkStart,
        );

        if (chunkTo === range.to) {
          break;
        }
        chunkFrom = chunkTo + 1;
      }

      logExecutionTime(
        formatAccountCreationOperation(
          'keyring_createAccounts createMany',
          accountCreationDetails,
        ),
        createManyStart,
      );

      const responseMappingStart = Date.now();
      const result = accounts.map(mapToKeyringAccount);
      logExecutionTime(
        formatAccountCreationOperation(
          'keyring_createAccounts response mapping',
          accountCreationDetails,
        ),
        responseMappingStart,
      );
      return result;
    } finally {
      if (traceStarted) {
        await runSnapActionSafely(
          async () => this.#snapClient.endTrace(traceName),
          this.#logger,
          'endTrace',
        );
      }
      logExecutionTime(
        formatAccountCreationOperation(
          'keyring_createAccounts',
          accountCreationDetails,
        ),
        start,
      );
      await this.#logCreateAccountsState(stateLogDetails);
    }
  }

  async #logCreateAccountsState(
    details: CreateAccountsStateLogDetails,
  ): Promise<void> {
    await runSnapActionSafely(
      async () => {
        const [root, accounts, derivationPaths] = await Promise.all([
          this.#snapClient.getState(),
          this.#snapClient.getState('accounts'),
          this.#snapClient.getState('derivationPaths'),
        ]);

        console.log(
          formatCreateAccountsStateLog(details, {
            root,
            accounts,
            derivationPaths,
          }),
        );
      },
      this.#logger,
      'logCreateAccountsState',
    );
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

      const accountsWithThisScope = allAccounts.filter((account) =>
        account.scopes.includes(scope),
      );

      if (accountsWithThisScope.length === 0) {
        throw new Error('No accounts with this scope');
      }

      const { address: addressToValidate } =
        requestWithoutCommonHeader.params.account;

      const foundAccount = accountsWithThisScope.find(
        (account) => account.address === addressToValidate,
      );

      if (!foundAccount) {
        throw new Error('Account not found');
      }

      return { address: `${scope}:${addressToValidate}` };
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
