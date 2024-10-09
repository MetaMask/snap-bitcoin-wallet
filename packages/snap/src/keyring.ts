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
import {
  MethodNotFoundError,
  UnauthorizedError,
  type Json,
} from '@metamask/snaps-sdk';
import type { Infer } from 'superstruct';
import { assert, object, StructError } from 'superstruct';
import { v4 as uuidv4 } from 'uuid';

import type { BtcAccount, BtcWallet } from './bitcoin/wallet';
import { Config } from './config';
import { Caip2Asset, Caip2ChainId } from './constants';
import { AccountNotFoundError, MethodNotImplementedError } from './exceptions';
import { Factory } from './factory';
import { getBalances, type SendManyParams, sendMany } from './rpcs';
import {
  TransactionStatus,
  type KeyringStateManager,
  type SendFlowRequest,
  type Wallet,
} from './stateManagement';
import { generateConfirmationReviewInterface } from './ui/render-interfaces';
import { sendManyParamsToSendFlowParams } from './ui/utils';
import {
  getProvider,
  ScopeStruct,
  logger,
  verifyIfAccountValid,
} from './utils';

export type KeyringOptions = Record<string, Json> & {
  defaultIndex: number;
  multiAccount?: boolean;
  origin: string;
};

export const CreateAccountOptionsStruct = object({
  scope: ScopeStruct,
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
          accountNameSuggestion: this.getKeyringAccountNameSuggestion(options),
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

  async filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    const walletData = await this._stateMgr.getWallet(id);
    return walletData && chains.includes(walletData.scope)
      ? [walletData.scope]
      : [];
  }

  async updateAccount(_account: KeyringAccount): Promise<void> {
    throw new MethodNotImplementedError();
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

    verifyIfAccountValid(account, walletData.account);

    this.verifyIfMethodValid(method, walletData.account);
    const asset =
      scope === Caip2ChainId.Mainnet ? Caip2Asset.Btc : Caip2Asset.TBtc;

    switch (method) {
      case 'btc_sendmany': {
        const balances = await getBalances(account, {
          assets: [asset],
          scope,
        });

        // TODO: replace with actual call
        const rates = '64000';

        const sendFlowRequest: SendFlowRequest = {
          id: uuidv4(),
          account: walletData.account,
          scope,
          transaction: params as SendManyParams,
          interfaceId: '',
          status: TransactionStatus.Review,
          ...(await sendManyParamsToSendFlowParams(
            params as SendManyParams,
            walletData.account.id,
            scope,
            rates,
            balances[asset].amount,
          )),
        };

        const interfaceId = await generateConfirmationReviewInterface({
          request: sendFlowRequest,
        });

        sendFlowRequest.interfaceId = interfaceId;

        await this._stateMgr.upsertRequest(sendFlowRequest);
        const result = await snap.request({
          method: 'snap_dialog',
          params: {
            id: interfaceId,
          },
        });

        if (!result) {
          sendFlowRequest.status = TransactionStatus.Rejected;
          await this._stateMgr.upsertRequest(sendFlowRequest);
          throw new Error('User rejected the request');
        }
        await this._stateMgr.upsertRequest(sendFlowRequest);

        const tx = await sendMany(account, this._options.origin, {
          ...sendFlowRequest.transaction,
          scope,
        });

        sendFlowRequest.txId = tx.txId;
        return tx;
      }
      default:
        throw new MethodNotFoundError() as unknown as Error;
    }
  }

  async #emitEvent(
    event: KeyringEvent,
    data: Record<string, Json>,
  ): Promise<void> {
    // @ts-expect-error TODO: fix type
    await emitSnapKeyringEvent(getProvider(), event, data);
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

      verifyIfAccountValid(account, walletData.account);

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
      throw new AccountNotFoundError();
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

  protected verifyIfMethodValid(
    method: string,
    keyringAccount: KeyringAccount,
  ): void {
    const validMethods = [...keyringAccount.methods, 'btc_initiateSendMany'];
    if (!validMethods.includes(method)) {
      throw new UnauthorizedError(`Permission denied`) as unknown as Error;
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

  protected getKeyringAccountNameSuggestion(
    options?: CreateAccountOptions,
  ): string {
    switch (options?.scope) {
      case Caip2ChainId.Mainnet:
        return 'Bitcoin Account';
      case Caip2ChainId.Testnet:
        return 'Bitcoin Testnet Account';

      default:
        // Leave it blank to fallback to auto-suggested name on the extension side
        return '';
    }
  }
}
