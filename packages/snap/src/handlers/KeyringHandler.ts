import {
  emitSnapKeyringEvent,
  KeyringEvent,
  BtcMethod,
} from '@metamask/keyring-api';
import type {
  KeyringAccountData,
  Keyring,
  KeyringAccount,
  KeyringRequest,
  KeyringResponse,
  Balance,
  CaipAssetType,
} from '@metamask/keyring-api';
import type { Json } from '@metamask/utils';
import { assert, enums, object, optional } from 'superstruct';

import type { BitcoinAccount, AccountsConfig } from '../entities';
import type { AccountUseCases } from '../usecases/AccountUseCases';
import { getProvider } from '../utils';
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
  readonly #accounts: AccountUseCases;

  readonly #config: AccountsConfig;

  constructor(accounts: AccountUseCases, config: AccountsConfig) {
    this.#accounts = accounts;
    this.#config = config;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    throw new Error('Method not implemented.');
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    throw new Error('Method not implemented.');
  }

  async createAccount(
    opts: Record<string, Json> = {},
  ): Promise<KeyringAccount> {
    assert(opts, CreateAccountRequest);

    const account = await this.#accounts.createAccount(
      caip2ToNetwork[opts.scope ?? this.#config.defaultNetwork],
      caip2ToAddressType[opts.addressType ?? this.#config.defaultAddressType],
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
      type: addressTypeToCaip2[account.addressType] as KeyringAccount['type'],
      id: account.id,
      address: account.nextUnusedAddress().address,
      options: {},
      methods: [BtcMethod.SendBitcoin],
    };
  }
}
