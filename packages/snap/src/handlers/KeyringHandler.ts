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
  BtcMethod,
} from '@metamask/keyring-api';
import type { Json } from '@metamask/utils';
import { assert, StructError } from 'superstruct';

import { ConfigV2 } from '../configv2';
import type { AccountRepository } from '../store';
import { getProvider, logger } from '../utils';
import { CreateAccountRquest } from './requests';
import {
  addressTypeToCaip2,
  caip2ToAddressType,
  caip2ToNetwork,
} from './caip2';

export class KeyringHandler implements Keyring {
  protected readonly _accounts: AccountRepository;

  protected readonly _methods = [BtcMethod.SendBitcoin];

  constructor(accounts: AccountRepository) {
    this._accounts = accounts;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    throw new Error('Method not implemented.');
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    throw new Error('Method not implemented.');
  }

  async createAccount(options?: Record<string, Json>): Promise<KeyringAccount> {
    logger.debug('Creating new Bitcoin account: %o', options);

    try {
      assert(options, CreateAccountRquest);

      const account = await this._accounts.insert(
        caip2ToNetwork[options.scope ?? ConfigV2.accounts.defaultNetwork],
        caip2ToAddressType[
          options.addressType ?? ConfigV2.accounts.defaultAddressType
        ],
      );

      const keyringAccount = {
        type: addressTypeToCaip2[account.addressType],
        id: account.id,
        address: account.nextUnusedAddress.address,
        options: {},
        methods: this._methods,
      } as KeyringAccount;

      await emitSnapKeyringEvent(getProvider(), KeyringEvent.AccountCreated, {
        account: keyringAccount,
        accountNameSuggestion: account.suggestedName,
      });

      logger.info('Bitcoin account created successfully: %o', options);
      return keyringAccount;
    } catch (error) {
      logger.error('failed to create Bitcoin account: %o', error);

      if (error instanceof StructError) {
        throw new Error('Invalid params to create an account');
      }
      throw new Error(error);
    }
  }

  getAccountBalances?(
    id: string,
    assets: CaipAssetType[],
  ): Promise<Record<CaipAssetType, Balance>> {
    throw new Error('Method not implemented.');
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
