import type { AddressType } from '@metamask/bitcoindevkit';
import { Amount } from '@metamask/bitcoindevkit';
import {
  AccountCreationType,
  assertCreateAccountOptionIsSupported,
  BtcScope,
} from '@metamask/keyring-api';
import type {
  Balance,
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
import { assert, is, string } from 'superstruct';
import { encode } from 'wif';

import {
  computeDisplayBalanceSats,
  FormatError,
  type BitcoinAccount,
  type Logger,
  networkToCurrencyUnit,
  type SnapClient,
} from '../entities';
import {
  NetworkStruct,
  networkToCaip19,
  scopeToNetwork,
} from './caip';
import { CronMethod } from './CronHandler';
import type { KeyringRequestHandler } from './KeyringRequestHandler';
import { mapToKeyringAccount, mapToTransaction } from './mappings';
import { BtcWalletRequestStruct, validateSelectedAccounts } from './validation';
import type {
  AccountUseCases,
  CreateAccountParams,
} from '../use-cases/AccountUseCases';

/** Maximum number of accounts to create in one internal createMany call. */
const MAX_CREATE_ACCOUNTS_PER_BATCH = 100;

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
      `${AccountCreationType.Bip44DeriveIndex}`,
      `${AccountCreationType.Bip44DeriveIndexRange}`,
      `${AccountCreationType.Bip44Discover}`,
    ]);

    const { entropySource } = options;

    // Only P2WPKH (BIP-84) on bitcoin mainnet is supported, mirroring the
    // defaults used by the legacy `createAccount` when no scope was provided.
    const network = scopeToNetwork[BtcScope.Mainnet];
    const addressType = this.#defaultAddressType;
    if (addressType !== 'p2wpkh') {
      throw new FormatError(
        'Only native segwit (P2WPKH) addresses are supported',
      );
    }

    // Validate range before starting the trace so FormatErrors surface cleanly.
    let range: { from: number; to: number } | undefined;
    if (options.type !== AccountCreationType.Bip44Discover) {
      range =
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
    }

    const traceName = 'Create Bitcoin Accounts Batch';
    const traceStarted = await this.#snapClient.startTrace(traceName);

    try {
      if (options.type === AccountCreationType.Bip44Discover) {
        // For discovery, only return the account if it has on-chain activity.
        // No activity means we've reached the end of the discoverable accounts,
        // so we return nothing and the client stops discovering.
        const account = await this.#accountsUseCases.discover({
          network,
          entropySource,
          index: options.groupIndex,
          addressType,
        });

        if (account.listTransactions().length === 0) {
          return [];
        }

        return [mapToKeyringAccount(account)];
      }

      // `AccountUseCases.createMany` is idempotent: if an account already
      // exists for the resolved derivation path, it will be returned as-is.
      const accounts: BitcoinAccount[] = [];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let chunkFrom = range!.from;

      while (chunkFrom <= range!.to) {
        const chunkTo = Math.min(
          chunkFrom + MAX_CREATE_ACCOUNTS_PER_BATCH - 1,
          range!.to,
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

        accounts.push(
          ...(await this.#accountsUseCases.createMany(chunkRequests)),
        );

        if (chunkTo === range!.to) {
          break;
        }
        chunkFrom = chunkTo + 1;
      }

      return accounts.map(mapToKeyringAccount);
    } catch (error: any) {
      this.#logger.error({ error }, 'Error creating accounts batch');
      throw new SnapError(error);
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
    // The SDK wire type only carries "hexadecimal" | "base58"; Bitcoin private
    // keys are exported as WIF which is a base58check format, so we treat any
    // "base58" request as a WIF export and default to "base58" when omitted.
    const encoding = options?.encoding ?? 'base58';
    if (encoding !== 'base58') {
      throw new Error(
        `Only base58 (WIF) private key export is supported, got: ${encoding}`,
      );
    }

    const account = await this.#accountsUseCases.get(accountId);

    const entropy = await this.#snapClient.getPrivateEntropy(
      // We export the private key for address index 0 (the primary address).
      account.derivationPath.concat(['0', '0']),
    );

    if (!entropy.privateKey) {
      throw new Error('Failed to get private entropy');
    }

    try {
      // Private key is returned in "0x..." format; transform to WIF (base58check).
      const wifPrivateKey = encode({
        version: account.network === 'bitcoin' ? 128 : 239, // 128 mainnet, 239 testnets
        // eslint-disable-next-line no-restricted-globals
        privateKey: Buffer.from(entropy.privateKey.slice(2), 'hex'),
        compressed: true,
      });

      // SECURITY: use is() not assert() to avoid embedding the private key in a
      // StructError message if encoding validation fails.
      if (!is(wifPrivateKey, string())) {
        throw new Error('Derived private key failed encoding validation');
      }

      return {
        type: 'private-key',
        encoding,
        privateKey: wifPrivateKey,
      };
    } catch (error: any) {
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
