import {
  type Keyring,
  type KeyringAccount,
  type KeyringRequest,
  type KeyringResponse,
  type Balance,
  type CaipAssetType,
} from '@metamask/keyring-api';

import type { Infer } from 'superstruct';
import { object } from 'superstruct';

import { Config } from '../config';
import { KeyringStateManager } from '../stateManagement';
import { ScopeStruct } from '../utils';
import { BtcKeyring } from '../keyring';
import { KeyringService } from './KeyringService';
import { Json } from '@metamask/utils';
import { BdkAccountRepository } from '../store/BdkAccountRepository';

export const CreateAccountOptionsStruct = object({
  scope: ScopeStruct,
});

export type CreateAccountOptions = Record<string, Json> &
  Infer<typeof CreateAccountOptionsStruct>;

/**
 * Temporary Keyring implementation during the transition to the new Keyring (using BDK)
 */
export class MasterKeyringService implements Keyring {
  protected readonly _keyringV1: BtcKeyring;

  protected readonly _keyringV2: KeyringService;

  constructor(origin: string) {
    this._keyringV1 = new BtcKeyring(new KeyringStateManager(), {
      defaultIndex: Config.wallet.defaultAccountIndex,
      origin,
    });

    this._keyringV2 = new KeyringService(
      new BdkAccountRepository(Config.wallet.defaultAccountIndex),
    );
  }

  listAccounts(): Promise<KeyringAccount[]> {
    return this._keyringV1.listAccounts();
  }

  getAccount(id: string): Promise<KeyringAccount | undefined> {
    return this._keyringV1.getAccount(id);
  }

  async createAccount(options?: CreateAccountOptions): Promise<KeyringAccount> {
    await this._keyringV2.createAccount(options);
    return this._keyringV1.createAccount(options);
  }

  getAccountBalances?(
    id: string,
    assets: CaipAssetType[],
  ): Promise<Record<CaipAssetType, Balance>> {
    return this._keyringV1.getAccountBalances(id, assets);
  }

  filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    return this._keyringV1.filterAccountChains(id, chains);
  }

  updateAccount(account: KeyringAccount): Promise<void> {
    return this._keyringV1.updateAccount(account);
  }

  deleteAccount(id: string): Promise<void> {
    return this._keyringV1.deleteAccount(id);
  }

  submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    return this._keyringV1.submitRequest(request);
  }
}
