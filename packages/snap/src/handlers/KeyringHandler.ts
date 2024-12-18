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
import { assert, enums, object, optional } from 'superstruct';

import type { BitcoinAccount, AccountsConfig } from '../entities';
import type { AccountUseCases } from '../usecases/AccountUseCases';
import { getProvider } from '../utils';
import { networkToCaip19 } from './caip19';
import {
  addressTypeToCaip2,
  Caip2AddressType,
  Caip2ChainId,
  caip2ToAddressType,
  caip2ToNetwork,
} from './caip2';

export const CreateAccountRequest = object({
  scope: optional(enums(Object.values(Caip2ChainId))),
  addressType: optional(enums(Object.values(Caip2AddressType))),
});

// TODO: enable when all methods are implemented
/* eslint-disable @typescript-eslint/no-unused-vars */

export class KeyringHandler implements Keyring {
  protected readonly _accounts: AccountUseCases;

  protected readonly _config: AccountsConfig;

  constructor(accounts: AccountUseCases, config: AccountsConfig) {
    this._accounts = accounts;
    this._config = config;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    throw new Error('Method not implemented.');
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    const account = await this._accounts.get(id);
    return this.#toKeyringAccount(account);
  }

  async createAccount(options?: Record<string, Json>): Promise<KeyringAccount> {
    const opts = options ?? {};
    assert(opts, CreateAccountRequest);

    const account = await this._accounts.create(
      caip2ToNetwork[opts.scope ?? this._config.defaultNetwork],
      caip2ToAddressType[opts.addressType ?? this._config.defaultAddressType],
    );

    const keyringAccount = this.#toKeyringAccount(account);
    await emitSnapKeyringEvent(getProvider(), KeyringEvent.AccountCreated, {
      account: keyringAccount,
      accountNameSuggestion: account.suggestedName,
    });

    return keyringAccount;
  }

  async getAccountBalances(
    id: string,
    _: CaipAssetType[],
  ): Promise<Record<CaipAssetType, Balance>> {
    const account = await this._accounts.synchronize(id);
    const balance = account.balance.trusted_spendable.to_btc().toString();

    return {
      [networkToCaip19[account.network]]: {
        amount: balance,
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

  async exportAccount(id: string): Promise<KeyringAccountData> {
    throw new Error('Method not implemented.');
  }

  async listRequests(): Promise<KeyringRequest[]> {
    throw new Error('Method not implemented.');
  }

  async getRequest(id: string): Promise<KeyringRequest | undefined> {
    throw new Error('Method not implemented.');
  }

  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    throw new Error('Method not implemented.');
  }

  async approveRequest(id: string, data?: Record<string, Json>): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async rejectRequest(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  #toKeyringAccount(account: BitcoinAccount): KeyringAccount {
    return {
      type: addressTypeToCaip2[account.addressType],
      id: account.id,
      address: account.nextUnusedAddress().address,
      options: {},
      methods: [BtcMethod.SendBitcoin],
    } as KeyringAccount;
  }
}
