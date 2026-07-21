import type { AddressType } from '@metamask/bitcoindevkit';
import { Amount } from '@metamask/bitcoindevkit';
import {
  AccountCreationType,
  assertCreateAccountOptionIsSupported,
} from '@metamask/keyring-api';
import type {
  Balance,
  BtcScope,
  CaipAssetType,
  CaipAssetTypeOrId,
  CreateAccountOptions,
  KeyringAccount,
  KeyringRequest,
  KeyringResponse,
  Paginated,
  Pagination,
  ResolvedAccountAddress,
  Transaction,
} from '@metamask/keyring-api';
import type {
  ExportAccountOptions,
  ExportedAccount,
  KeyringSnapRpc,
} from '@metamask/keyring-api/v2';
import { SnapError } from '@metamask/snaps-sdk';
import type { CaipChainId, JsonRpcRequest } from '@metamask/snaps-sdk';
import { sensitive } from '@metamask/superstruct';
import { assert, is, string } from 'superstruct';
import { encode } from 'wif';

import {
  computeDisplayBalanceSats,
  FormatError,
  type Logger,
  networkToCurrencyUnit,
  type SnapClient,
} from '../entities';
import { NetworkStruct, networkToCaip19, scopeToNetwork } from './caip';
import { CronMethod } from './CronHandler';
import type { KeyringRequestHandler } from './KeyringRequestHandler';
import { mapToKeyringAccount, mapToTransaction } from './mappings';
import { parseDerivationPath } from './parsers';
import { BtcWalletRequestStruct, validateSelectedAccounts } from './validation';
import snapManifest from '../../snap.manifest.json';
import type {
  AccountUseCases,
  CreateAccountParams,
} from '../use-cases/AccountUseCases';

/** Maximum number of accounts to create in one internal createMany call. */
const MAX_CREATE_ACCOUNTS_PER_BATCH = 100;

/**
 * Scopes declared in the snap manifest's keyring capabilities block.
 * Used to determine which networks are supported for account discovery.
 */
const SUPPORTED_SCOPES = snapManifest.initialPermissions['endowment:keyring']
  .capabilities.scopes as readonly BtcScope[];

export class KeyringHandler implements KeyringSnapRpc {
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

  async getAccounts(): Promise<KeyringAccount[]> {
    const accounts = await this.#accountsUseCases.list();
    return accounts.map(mapToKeyringAccount);
  }

  async getAccount(id: string): Promise<KeyringAccount> {
    const account = await this.#accountsUseCases.get(id);
    return mapToKeyringAccount(account);
  }

  async createAccounts(
    options: CreateAccountOptions,
  ): Promise<KeyringAccount[]> {
    assertCreateAccountOptionIsSupported(options, [
      `${AccountCreationType.Bip44DerivePath}`,
      `${AccountCreationType.Bip44DeriveIndex}`,
      `${AccountCreationType.Bip44DeriveIndexRange}`,
      `${AccountCreationType.Bip44Discover}`,
    ]);

    const { entropySource } = options;

    const addressType = this.#defaultAddressType;
    if (addressType !== 'p2wpkh') {
      throw new FormatError(
        'Only native segwit (P2WPKH) addresses are supported',
      );
    }

    const traceName = 'Create Bitcoin Accounts Batch';
    const traceStarted = await this.#snapClient.startTrace(traceName);

    try {
      if (options.type === AccountCreationType.Bip44DerivePath) {
        const { index, network } = parseDerivationPath(options.derivationPath);

        const created = await this.#accountsUseCases.createMany([
          {
            network,
            entropySource,
            index,
            addressType,
            synchronize: false,
          },
        ]);

        return created.map(mapToKeyringAccount);
      }

      if (options.type === AccountCreationType.Bip44Discover) {
        // For each supported scope, discover at this index. Accounts with
        // on-chain activity are kept; those without are deleted. Returning []
        // signals end-of-discovery to the client.
        const discovered: KeyringAccount[] = [];

        for (const scope of SUPPORTED_SCOPES) {
          const network = scopeToNetwork[scope];
          const account = await this.#accountsUseCases.discover({
            network,
            entropySource,
            index: options.groupIndex,
            addressType,
          });

          if (account.listTransactions().length === 0) {
            await this.#accountsUseCases.delete(account.id);
          } else {
            discovered.push(mapToKeyringAccount(account));
          }
        }

        return discovered;
      }

      // Build the index range. For Bip44DeriveIndex the range is a single
      // element; for Bip44DeriveIndexRange it comes from the options directly.
      // At this point the discover branch has already returned, so this
      // discriminant is exhaustive.
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

      // `AccountUseCases.createMany` is idempotent: if an account already
      // exists for the resolved derivation path, it will be returned as-is.
      const created: KeyringAccount[] = [];

      for (const scope of SUPPORTED_SCOPES) {
        const network = scopeToNetwork[scope];
        let chunkFrom = range.from;

        while (chunkFrom <= range.to) {
          const chunkTo = Math.min(
            chunkFrom + MAX_CREATE_ACCOUNTS_PER_BATCH - 1,
            range.to,
          );
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

          const chunk = await this.#accountsUseCases.createMany(chunkRequests);
          created.push(...chunk.map(mapToKeyringAccount));

          chunkFrom = chunkTo + 1;
        }
      }

      return created;
    } catch (error: unknown) {
      this.#logger.error({ error }, 'Error creating accounts batch');
      throw new SnapError(error as Error);
    } finally {
      if (traceStarted) {
        await this.#snapClient.endTrace(traceName);
      }
    }
  }

  async exportAccount(
    accountId: string,
    options?: ExportAccountOptions,
  ): Promise<ExportedAccount> {
    // TODO: update to `"wif"` once the accounts repo adds WIF as a named
    // encoding. WIF is Base58Check (not plain base58), so we treat the current
    // `"base58"` wire value as a WIF request in the meantime.
    const encoding = options?.encoding ?? 'base58';
    if (encoding !== 'base58') {
      throw new Error(
        `Only base58 (WIF) private key export is supported, got: ${encoding}`,
      );
    }

    const account = await this.#accountsUseCases.get(accountId);

    const entropy = await this.#snapClient.getPrivateEntropy(
      // Export the private key for address index 0 (the primary address).
      account.derivationPath.concat(['0', '0']),
    );

    if (!entropy.privateKey) {
      throw new Error('Failed to get private entropy');
    }

    try {
      // Private key is returned in "0x..." format; transform to WIF (Base58Check).
      const wifPrivateKey = encode({
        version: account.network === 'bitcoin' ? 128 : 239, // 128 mainnet, 239 testnets
        // eslint-disable-next-line no-restricted-globals
        privateKey: Buffer.from(entropy.privateKey.slice(2), 'hex'),
        compressed: true,
      });

      // SECURITY: use is() not assert() to avoid embedding the private key in a
      // StructError message if encoding validation fails.
      // TODO: replace string() with a WIF-specific struct once the accounts
      // repo exports one.
      if (!is(wifPrivateKey, sensitive(string()))) {
        throw new Error('Derived private key failed encoding validation');
      }

      return {
        type: 'private-key',
        encoding,
        privateKey: wifPrivateKey,
      };
    } catch {
      const errorMsg = 'Error exporting account';
      this.#logger.error(errorMsg);
      throw new SnapError(errorMsg);
    }
  }

  async getAccountBalances(
    id: string,
  ): Promise<Record<CaipAssetType, Balance>> {
    const account = await this.#accountsUseCases.get(id);
    const balance = Amount.from_sat(computeDisplayBalanceSats(account))
      .to_btc()
      .toString();

    return {
      [networkToCaip19[account.network]]: {
        amount: balance,
        unit: networkToCurrencyUnit[account.network],
      },
    };
  }

  async deleteAccount(id: string): Promise<void> {
    await this.#accountsUseCases.delete(id);
  }

  async getAccountAssets(id: string): Promise<CaipAssetTypeOrId[]> {
    const account = await this.#accountsUseCases.get(id);
    return [networkToCaip19[account.network]];
  }

  async getAccountTransactions(
    id: string,
    { limit, next }: Pagination,
  ): Promise<Paginated<Transaction>> {
    const account = await this.#accountsUseCases.get(id);
    const transactions = account.listTransactions();

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
        ? (paginatedTxs[paginatedTxs.length - 1]?.txid.toString() ?? null)
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
   * be used to process this signing request, or null if no candidates
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

      const allAccounts = await this.getAccounts();

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
      await this.#snapClient.emitTrackingError(error as Error);

      this.#logger.error({ error }, 'Error resolving account address');
      return null;
    }
  }
}
