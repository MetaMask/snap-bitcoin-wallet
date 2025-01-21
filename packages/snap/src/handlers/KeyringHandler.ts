import { BtcScopes } from '@metamask/keyring-api';
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

import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { networkToCaip19 } from './caip19';
import { Caip2AddressType, caip2ToAddressType, caip2ToNetwork } from './caip2';
import { snapToKeyringAccount } from './keyring-account';

export const CreateAccountRequest = object({
  scope: enums(Object.values(BtcScopes)),
  addressType: optional(enums(Object.values(Caip2AddressType))),
});

// TODO: enable when all methods are implemented
/* eslint-disable @typescript-eslint/no-unused-vars */

export class KeyringHandler implements Keyring {
  readonly #accountsUseCases: AccountUseCases;

  constructor(accounts: AccountUseCases) {
    this.#accountsUseCases = accounts;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    throw new Error('Method not implemented.');
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    const account = await this.#accountsUseCases.get(id);
    return snapToKeyringAccount(account);
  }

  async createAccount(opts: Record<string, Json>): Promise<KeyringAccount> {
    assert(opts, CreateAccountRequest);

    const account = await this.#accountsUseCases.create(
      caip2ToNetwork[opts.scope],
      opts.addressType ? caip2ToAddressType[opts.addressType] : undefined,
    );

    return snapToKeyringAccount(account);
  }

  async getAccountBalances(
    id: string,
  ): Promise<Record<CaipAssetType, Balance>> {
    const account = await this.#accountsUseCases.synchronize(id);
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
}
