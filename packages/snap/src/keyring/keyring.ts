import {
  KeyringEvent,
  emitSnapKeyringEvent,
  type Keyring,
  type KeyringAccount,
  type KeyringRequest,
  type KeyringResponse,
} from '@metamask/keyring-api';
import { MethodNotFoundError, type Json } from '@metamask/snaps-sdk';
import { assert, StructError } from 'superstruct';
import { v4 as uuidv4 } from 'uuid';

import { Config } from '../config';
import { Factory } from '../factory';
import { logger } from '../modules/logger/logger';
import type { SnapRpcHandlerRequest } from '../modules/rpc';
import { SnapHelper } from '../modules/snap';
import { RpcHelper } from '../rpcs/helpers';
import type { IAccount, IWallet } from '../wallet';
import { BtcKeyringError } from './exceptions';
import type { KeyringStateManager } from './state';
import {
  CreateAccountOptionsStruct,
  type ChainRPCHandlers,
  type CreateAccountOptions,
  type KeyringOptions,
} from './types';

export class BtcKeyring implements Keyring {
  protected readonly stateMgr: KeyringStateManager;

  protected readonly options: KeyringOptions;

  protected readonly keyringMethods: string[];

  protected readonly handlers: ChainRPCHandlers;

  constructor(stateMgr: KeyringStateManager, options: KeyringOptions) {
    this.stateMgr = stateMgr;
    this.options = options;
    const mapping = RpcHelper.getKeyringRpcApiHandlers();
    this.keyringMethods = Object.keys(mapping);
    this.handlers = mapping;
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

      const wallet: IWallet = Factory.createWallet(options.scope);

      // TODO: Create account with index 0 for now for phase 1 scope, update to use increment index later
      const index = Config.wallet[Config.chain].defaultAccountIndex;
      const account = await wallet.unlock(
        index,
        Config.wallet[Config.chain].defaultAccountType,
      );

      logger.info(
        `[BtcKeyring.createAccount] Account unlocked: ${account.address}`,
      );

      const keyringAccount = this.newKeyringAccount(account, {
        scope: options.scope,
        index,
      });

      logger.info(
        `[BtcKeyring.createAccount] Keyring account data: ${JSON.stringify(
          keyringAccount,
        )}`,
      );

      await this.stateMgr.withTransaction(async () => {
        await this.stateMgr.addWallet({
          account: keyringAccount,
          hdPath: account.hdPath,
          index: account.index,
          scope: options.scope,
        });

        await this.#emitEvent(KeyringEvent.AccountCreated, {
          account: keyringAccount,
        });
      });

      return keyringAccount;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[BtcKeyring.createAccount] Error: ${error.message}`);
      if (error instanceof StructError) {
        throw new BtcKeyringError('Invalid params to create account');
      }
      throw new BtcKeyringError(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    throw new BtcKeyringError('Method not implemented.');
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    try {
      await this.stateMgr.withTransaction(async () => {
        await this.stateMgr.updateAccount(account);
        await this.#emitEvent(KeyringEvent.AccountUpdated, { account });
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[BtcKeyring.updateAccount] Error: ${error.message}`);
      throw new BtcKeyringError(error);
    }
  }

  async deleteAccount(id: string): Promise<void> {
    try {
      await this.stateMgr.withTransaction(async () => {
        await this.stateMgr.removeAccounts([id]);
        await this.#emitEvent(KeyringEvent.AccountDeleted, { id });
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[BtcKeyring.deleteAccount] Error: ${error.message}`);
      throw new BtcKeyringError(error);
    }
  }

  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    return this.syncSubmitRequest(request);
  }

  protected async syncSubmitRequest(
    request: KeyringRequest,
  ): Promise<KeyringResponse> {
    return {
      pending: false,
      result: await this.handleSubmitRequest(request),
    };
  }

  protected async handleSubmitRequest(request: KeyringRequest): Promise<Json> {
    const { scope, account } = request;
    const { method, params } = request.request;
    if (!Object.prototype.hasOwnProperty.call(this.handlers, method)) {
      throw new MethodNotFoundError() as unknown as Error;
    }

    const walletData = await this.stateMgr.getWallet(account);

    if (!walletData) {
      throw new Error('Account not found');
    }

    if (walletData.scope !== scope) {
      throw new Error(
        `Account's scope does not match with the request's scope`,
      );
    }

    return this.handlers[method].getInstance(walletData).execute({
      ...params,
      scope,
    } as unknown as SnapRpcHandlerRequest);
  }

  async #emitEvent(
    event: KeyringEvent,
    data: Record<string, Json>,
  ): Promise<void> {
    // TODO: Temp solutio to support keyring in snap without keyring API
    if (this.options.emitEvents) {
      await emitSnapKeyringEvent(SnapHelper.wallet, event, data);
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
