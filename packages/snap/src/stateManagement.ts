import type { KeyringAccount } from '@metamask/keyring-api';

import type { Wallet, SnapState } from './keyring';
import { compactError, SnapStateManager } from './utils';

export class KeyringStateManager extends SnapStateManager<SnapState> {
  protected override async get(): Promise<SnapState> {
    return super.get().then((state: SnapState) => {
      if (!state) {
        // eslint-disable-next-line no-param-reassign
        state = {
          walletIds: [],
          wallets: {},
        };
      }

      if (!state.walletIds) {
        state.walletIds = [];
      }

      if (!state.wallets) {
        state.wallets = {};
      }

      return state;
    });
  }

  async listAccounts(): Promise<KeyringAccount[]> {
    try {
      const state = await this.get();
      return state.walletIds.map((id) => state.wallets[id].account);
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  async addWallet(wallet: Wallet): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        const { id, address } = wallet.account;
        if (
          this.isAccountExist(state, id) ||
          this.getAccountByAddress(state, address)
        ) {
          throw new Error(`Account address ${address} already exists`);
        }

        state.wallets[id] = wallet;
        state.walletIds.push(id);
      });
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        if (!this.isAccountExist(state, account.id)) {
          throw new Error(`Account id ${account.id} does not exist`);
        }

        const wallet = state.wallets[account.id];
        const accountInState = wallet.account;

        if (
          accountInState.address.toLowerCase() !==
            account.address.toLowerCase() ||
          accountInState.type !== account.type
        ) {
          throw new Error(`Account address or type is immutable`);
        }

        state.wallets[account.id].account = account;
      });
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  async removeAccounts(ids: string[]): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        const removeIds = new Set<string>();

        for (const id of ids) {
          if (!this.isAccountExist(state, id)) {
            throw new Error(`Account id ${id} does not exist`);
          }
          removeIds.add(id);
        }

        removeIds.forEach((id) => delete state.wallets[id]);
        state.walletIds = state.walletIds.filter((id) => !removeIds.has(id));
      });
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  async getAccount(id: string): Promise<KeyringAccount | null> {
    try {
      const state = await this.get();
      return state.wallets[id]?.account ?? null;
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  async getWallet(id: string): Promise<Wallet | null> {
    try {
      const state = await this.get();
      return state.wallets[id] ?? null;
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  protected getAccountByAddress(
    state: SnapState,
    address: string,
  ): KeyringAccount | null {
    return (
      Object.values(state.wallets).find(
        (wallet) => wallet.account.address.toString() === address.toLowerCase(),
      )?.account ?? null
    );
  }

  protected isAccountExist(state: SnapState, id: string): boolean {
    return Object.prototype.hasOwnProperty.call(state.wallets, id);
  }
}
