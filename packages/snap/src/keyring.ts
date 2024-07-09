import {
  KeyringEvent,
  emitSnapKeyringEvent,
  type Keyring,
  type KeyringAccount,
  type KeyringRequest,
  type KeyringResponse,
  type Balance,
  type CaipAssetType,
} from '@metamask/keyring-api';
import { MethodNotFoundError, type Json } from '@metamask/snaps-sdk';
import type { Infer } from 'superstruct';
import { assert, object, StructError } from 'superstruct';
import { v4 as uuidv4 } from 'uuid';

import type { BtcAccount, BtcWallet } from './bitcoin/wallet';
import { Config } from './config';
import { Factory } from './factory';
import { getBalances, type SendManyParams, sendMany } from './rpcs';
import type { KeyringStateManager, Wallet } from './stateManagement';
import { getProvider, scopeStruct, logger } from './utils';

export type KeyringOptions = Record<string, Json> & {
  defaultIndex: number;
  multiAccount?: boolean;
  origin: string;
  // TODO: Remove temp solution to support keyring in snap without keyring API
  emitEvents?: boolean;
};

export const CreateAccountOptionsStruct = object({
  scope: scopeStruct,
});

export type CreateAccountOptions = Record<string, Json> &
  Infer<typeof CreateAccountOptionsStruct>;

export class BtcKeyring implements Keyring {
  protected readonly _stateMgr: KeyringStateManager;

  protected readonly _options: KeyringOptions;

  protected readonly _methods = ['btc_sendmany'];

  constructor(stateMgr: KeyringStateManager, options: KeyringOptions) {
    this._stateMgr = stateMgr;
    this._options = options;
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    try {
      return await this._stateMgr.listAccounts();
    } catch (error) {
      throw new Error(error);
    }
  }

  async getAccount(id: string): Promise<KeyringAccount | undefined> {
    try {
      return (await this._stateMgr.getAccount(id)) ?? undefined;
    } catch (error) {
      throw new Error(error);
    }
  }

  async createAccount(options?: CreateAccountOptions): Promise<KeyringAccount> {
    try {
      assert(options, CreateAccountOptionsStruct);

      const wallet = this.getBtcWallet(options.scope);

      // TODO: Create account with index 0 for now for phase 1 scope, update to use increment index later
      const index = this._options.defaultIndex;
      const type = Config.wallet.defaultAccountType;

      const account = await this.discoverAccount(wallet, index, type);

      logger.info(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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

      await this._stateMgr.withTransaction(async () => {
        await this._stateMgr.addWallet({
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
        throw new Error('Invalid params to create an account');
      }
      throw new Error(error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    try {
      await this._stateMgr.withTransaction(async () => {
        await this._stateMgr.updateAccount(account);
        await this.#emitEvent(KeyringEvent.AccountUpdated, { account });
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[BtcKeyring.updateAccount] Error: ${error.message}`);
      throw new Error(error);
    }
  }

  async deleteAccount(id: string): Promise<void> {
    try {
      await this._stateMgr.withTransaction(async () => {
        await this._stateMgr.removeAccounts([id]);
        await this.#emitEvent(KeyringEvent.AccountDeleted, { id });
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[BtcKeyring.deleteAccount] Error: ${error.message}`);
      throw new Error(error);
    }
  }

  async submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    return {
      pending: false,
      result: await this.handleSubmitRequest(request),
    };
  }

  protected async handleSubmitRequest(request: KeyringRequest): Promise<Json> {
    const { scope, account: id } = request;
    const { method, params } = request.request;

    const walletData = await this.getWalletData(id);

    if (walletData.scope !== scope) {
      throw new Error(
        `Account's scope does not match with the request's scope`,
      );
    }

    const wallet = this.getBtcWallet(walletData.scope);
    const account = await this.discoverAccount(
      wallet,
      walletData.index,
      walletData.account.type,
    );

    this.verifyIfAccountValid(account, walletData.account);

    switch (method) {
      case 'btc_sendmany':
        return (await sendMany(account, this._options.origin, {
          ...params,
          scope: walletData.scope,
        } as unknown as SendManyParams)) as unknown as Json;
      default:
        throw new MethodNotFoundError(method) as unknown as Error;
    }
  }

  async #emitEvent(
    event: KeyringEvent,
    data: Record<string, Json>,
  ): Promise<void> {
    // TODO: Remove temp solution to support keyring in snap without extentions support
    if (this._options.emitEvents) {
      await emitSnapKeyringEvent(getProvider(), event, data);
    }
  }

  async getAccountBalances(
    id: string,
    assets: CaipAssetType[],
  ): Promise<Record<CaipAssetType, Balance>> {
    try {
      const walletData = await this.getWalletData(id);
      const wallet = this.getBtcWallet(walletData.scope);
      const account = await this.discoverAccount(
        wallet,
        walletData.index,
        walletData.account.type,
      );

      this.verifyIfAccountValid(account, walletData.account);

      return await getBalances(account, {
        assets,
        scope: walletData.scope,
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[BtcKeyring.getAccountBalances] Error: ${error.message}`);
      throw new Error(error);
    }
  }

  protected async getWalletData(id: string): Promise<Wallet> {
    const walletData = await this._stateMgr.getWallet(id);

    if (!walletData) {
      throw new Error('Account not found');
    }

    return walletData;
  }

  protected getBtcWallet(scope: string): BtcWallet {
    return Factory.createWallet(scope);
  }

  protected async discoverAccount(
    wallet: BtcWallet,
    index: number,
    type: string,
  ): Promise<BtcAccount> {
    return await wallet.unlock(index, type);
  }

  protected verifyIfAccountValid(
    account: BtcAccount,
    keyringAccount: KeyringAccount,
  ): void {
    if (!account || account.address !== keyringAccount.address) {
      throw new Error('Account not found');
    }
  }

  protected newKeyringAccount(
    account: BtcAccount,
    options?: CreateAccountOptions,
  ): KeyringAccount {
    return {
      type: account.type,
      id: uuidv4(),
      address: account.address,
      options: {
        ...options,
      },
      methods: this._methods,
    } as unknown as KeyringAccount;
  }
}
