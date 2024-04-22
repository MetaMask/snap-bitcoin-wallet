import {
  KeyringEvent,
  emitSnapKeyringEvent,
  type Keyring,
  type KeyringAccount,
  type KeyringRequest,
  type KeyringResponse,
} from '@metamask/keyring-api';
import { type Json } from '@metamask/snaps-sdk';
import type { Infer } from 'superstruct';
import { assert, object, enums } from 'superstruct';
import { v4 as uuidv4 } from 'uuid';

import { Config } from '../config';
import { Factory } from '../factory';
import { logger } from '../logger/logger';
import { SnapHelper } from '../snap';
import { BtcKeyringError } from './exceptions';
import type { KeyringStateManager } from './state';
import type { IAccount, IAccountMgr, KeyringOptions } from './types';

export const CreateAccountOptionsStruct = object({
  scope: enums(Config.avaliableNetworks[Config.chain]),
});

export type CreateAccountOptions = Record<string, Json> &
  Infer<typeof CreateAccountOptionsStruct>;

export class BtcKeyring implements Keyring {
  protected readonly stateMgr: KeyringStateManager;

  protected readonly options: KeyringOptions;

  protected readonly keyringMethods = ['chain_getBalances'];

  constructor(options: KeyringOptions, stateMgr: KeyringStateManager) {
    this.stateMgr = stateMgr;
    this.options = options;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    try {
      return await this.stateMgr.listAccounts();
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
      assert(options, CreateAccountOptionsStruct);

      const accountMgr: IAccountMgr = Factory.createAccountMgr(
        Config.chain,
        options.scope,
      );

      // TODO: Create account with index 0 for now for phase 1 scope, update to use increment index later
      const index = this.options.defaultIndex;

      const account = await accountMgr.unlock(index);
      logger.info(
        `[BtcKeyring.createAccount] Account unlocked: ${account.address}`,
      );

      const keyringAccount = this.newKeyringAccount(account, {
        ...options,
        index,
      });

      logger.info(
        `[BtcKeyring.createAccount] Keyring account data: ${JSON.stringify(
          keyringAccount,
        )}`,
      );

      // TODO: Add 2 phase commit
      await this.stateMgr.addWallet({
        account: keyringAccount,
        type: account.type,
        index,
        scope: options?.scope,
      });

      await this.#emitEvent(KeyringEvent.AccountCreated, {
        account: keyringAccount,
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
      // TODO: Add 2 phase commit
      await this.stateMgr.updateAccount(account);
      await this.#emitEvent(KeyringEvent.AccountUpdated, { account });
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  async deleteAccount(id: string): Promise<void> {
    try {
      // TODO: Add 2 phase commit
      await this.stateMgr.removeAccounts([id]);
      await this.#emitEvent(KeyringEvent.AccountDeleted, { id });
    } catch (error) {
      throw new BtcKeyringError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    throw new BtcKeyringError('Method not implemented.');
  }

  async #emitEvent(
    event: KeyringEvent,
    data: Record<string, Json>,
  ): Promise<void> {
    try {
      await emitSnapKeyringEvent(SnapHelper.wallet, event, data);
    } catch (error) {
      logger.error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `[BtcKeyring.emitEvent] Error emitting event ${event}: ${error}`,
      );
    }
  }

  protected newKeyringAccount(
    account: IAccount,
    options?: CreateAccountOptions,
  ): KeyringAccount {
    return {
      type: account.type,
      id: uuidv4(),
      address: account.address,
      options: {
        ...options,
      },
      methods: this.keyringMethods,
    } as unknown as KeyringAccount;
  }
}
