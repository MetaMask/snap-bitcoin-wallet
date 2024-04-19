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
import { assert, instance, object, string } from 'superstruct';

export class BtcKeyring implements Keyring {
  protected readonly accountMgr?: IAccountMgr;

  protected readonly stateMgr: KeyringStateManager;

  protected readonly options: KeyringOptions;

  protected readonly keyringMethods = ['chain_getBalances'];

  constructor(
    options: KeyringOptions,
    stateMgr: KeyringStateManager,
    accountMgr?: IAccountMgr,
  ) {
    this.accountMgr = accountMgr;
    this.stateMgr = stateMgr;
    this.options = options;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    try {
      return (await this.stateMgr.listAccounts());
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    try {
      return (await this.stateMgr.getAccount(id)) ?? undefined;
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  async createAccount(options?: CreateAccountOptions): Promise<KeyringAccount> {
    try {
      assert(options?.scope, string());
      assert(this.accountMgr, object());
      // TODO: Create account with index 0 for now for phase 1 scope, update to use increment index later
      const index = this.options.defaultIndex;
      const account = await this.accountMgr.unlock(index);
      logger.info(
        `[BtcKeyring.createAccount] Account unlocked: ${account.address}`,
      );

      const keyringAccount = this.newKeyringAccount(account);

      logger.info(
        `[BtcKeyring.createAccount] Keyring account data: ${JSON.stringify(
          keyringAccount,
        )}`,
      );

      await this.stateMgr.addWallet({
        account: keyringAccount,
        type: account.type,
        index: account.index,
        scope : options?.scope ,
      });

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
      await this.stateMgr.updateAccount(account);
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

  protected newKeyringAccount(account: IAccount, options?: CreateAccountOptions): KeyringAccount {
    return {
      type: account.type,
      id: uuidv4(),
      address: account.address,
      options: {
        ...options
      },
      methods: this.keyringMethods,
    } as unknown as KeyringAccount;
  }
}
