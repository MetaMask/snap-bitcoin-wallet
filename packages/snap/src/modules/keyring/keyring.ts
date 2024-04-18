import type {
  Keyring,
  KeyringAccount,
  KeyringRequest,
  KeyringResponse,
} from '@metamask/keyring-api';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../logger/logger';
import { BtcKeyringError } from './exceptions';
import type { KeyringStateManager } from './state';
import type {
  IAccount,
  IAccountMgr,
  CreateAccountOptions,
  KeyringOptions,
} from './types';

export class BtcKeyring implements Keyring {
  protected readonly accountMgr: IAccountMgr;

  protected readonly stateMgr: KeyringStateManager;

  protected readonly options: KeyringOptions;

  constructor(
    accountMgr: IAccountMgr,
    stateMgr: KeyringStateManager,
    options: KeyringOptions,
  ) {
    this.accountMgr = accountMgr;
    this.stateMgr = stateMgr;
    this.options = options;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    try {
      const accounts = await this.stateMgr.listAccounts();
      return accounts;
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    try {
      const account = await this.stateMgr.getAccount(id);
      return account ?? undefined;
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  async createAccount(options?: CreateAccountOptions): Promise<KeyringAccount> {
    try {
      // TODO: Create account with index 0 for now for phase 1 scope, update to use increment index later
      const index = options?.index ?? this.options.defaultIndex;
      const account = await this.accountMgr.unlock(index);
      logger.info(
        `[BtcKeyring.createAccount] Account unlocked: ${account.address}`,
      );

      let keyringAccount = await this.stateMgr.getAccountByAddress(
        account.address,
      );

      if (keyringAccount) {
        return keyringAccount;
      }

      keyringAccount = this.newKeyringAccount(account);
      logger.info(
        `[BtcKeyring.createAccount] Keyring account data: ${JSON.stringify(
          keyringAccount,
        )}`,
      );

      await this.stateMgr.saveAccount(keyringAccount);

      return keyringAccount;
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    throw new BtcKeyringError('Method not implemented.');
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    try {
      await this.stateMgr.saveAccount(account);
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  async deleteAccount(id: string): Promise<void> {
    try {
      await this.stateMgr.removeAccounts([id]);
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    throw new BtcKeyringError('Method not implemented.');
  }

  protected newKeyringAccount(account: IAccount): KeyringAccount {
    return {
      type: 'bip32',
      id: uuidv4(),
      address: account.address,
      options: {
        hdPath: account.hdPath,
        index: account.index,
        type: account.type,
      },
      methods: [],
    } as unknown as KeyringAccount;
  }
}
