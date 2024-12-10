import type { KeyringAccountData } from '@metamask/keyring-api';
import {
  type Keyring,
  type KeyringAccount,
  type KeyringRequest,
  type KeyringResponse,
  type Balance,
  type CaipAssetType,
  emitSnapKeyringEvent,
  KeyringEvent,
} from '@metamask/keyring-api';
import type { Json } from '@metamask/utils';
import { assert, StructError } from 'superstruct';

import { ChainConfig, ConfigV2 } from '../configv2';
import type { AccountRepository } from '../store';
import { getProvider, logger } from '../utils';
import { CreateAccountRquest } from './requests';
import { caip2ToAddressType, caip2ToNetwork } from './caip2';
import { networkToCaip19 } from './caip19';
import { toKeyringAccount } from './responses';

export class KeyringHandler implements Keyring {
  protected readonly _accounts: AccountRepository;

  protected readonly _config: ChainConfig;

  constructor(accounts: AccountRepository, config: ChainConfig) {
    this._accounts = accounts;
    this._config = config;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    throw new Error('Method not implemented.');
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    logger.trace('Fetching account. ID: %s', id);

    const account = await this._accounts.get(id);
    if (!account) {
      return undefined;
    }

    logger.debug('Account fetched successfully: %s', account.id);
    return toKeyringAccount(account);
  }

  async createAccount(options?: Record<string, Json>): Promise<KeyringAccount> {
    logger.debug('Creating new Bitcoin account with options: %j', options);

    try {
      assert(options, CreateAccountRquest);

      const account = await this._accounts.insert(
        caip2ToNetwork[options.scope ?? ConfigV2.accounts.defaultNetwork],
        caip2ToAddressType[
          options.addressType ?? ConfigV2.accounts.defaultAddressType
        ],
      );

      const keyringAccount = toKeyringAccount(account);

      await emitSnapKeyringEvent(getProvider(), KeyringEvent.AccountCreated, {
        account: keyringAccount,
        accountNameSuggestion: account.suggestedName,
      });

      logger.info('Bitcoin account created successfully: %s', account.id);
      return keyringAccount;
    } catch (error) {
      logger.error('failed to create Bitcoin account. Error: %o', error);

      if (error instanceof StructError) {
        throw new Error('Invalid params to create an account');
      }
      throw new Error(error);
    }
  }

  async getAccountBalances?(
    id: string,
    assets: CaipAssetType[],
  ): Promise<Record<CaipAssetType, Balance>> {
    logger.trace('Fetching balance. ID: %s. Assets: %o', id, assets);

    const account = await this._accounts.get(id);
    if (!account) {
      return {};
    }

    // If the account is already scanned, we just sync it,
    // otherwise we do a full scan.
    if (account.isScanned) {
      logger.info('Syncing account. ID: %s', id);
      await account.sync(this._config.parallelRequests);
    } else {
      logger.info('Performing initial full scan. ID: %s', id);
      await account.fullScan(
        this._config.stopGap,
        this._config.parallelRequests,
      );
    }

    await this._accounts.update(account);

    logger.debug('Balance fetched successfully for account %s', id);
    return {
      [networkToCaip19[account.network]]: {
        amount: account.balance.trusted_spendable.to_btc().toString(),
        unit: 'BTC',
      },
    };
  }

  async filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async deleteAccount(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  exportAccount?(id: string): Promise<KeyringAccountData> {
    throw new Error('Method not implemented.');
  }

  listRequests?(): Promise<KeyringRequest[]> {
    throw new Error('Method not implemented.');
  }

  getRequest?(id: string): Promise<KeyringRequest | undefined> {
    throw new Error('Method not implemented.');
  }

  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    throw new Error('Method not implemented.');
  }

  approveRequest?(id: string, data?: Record<string, Json>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  rejectRequest?(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
