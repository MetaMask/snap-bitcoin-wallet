import type { KeyringAccount } from '@metamask/keyring-api';

import { Wallet, type SnapState } from '../../types/state';
import { SnapStateManager, StateError } from '../snap';

export class KeyringStateManager extends SnapStateManager<SnapState> {
  protected override async get(): Promise<SnapState> {
    return super.get().then((state: SnapState) => {
      if (!state) {
        // eslint-disable-next-line no-param-reassign
        state = {
          accounts: [],
          wallets: {},
        };
      }

      if (!state.accounts) {
        state.accounts = [];
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
      return state.accounts.map((id) => state.wallets[id].account);
    } catch (error) {
      throw new StateError(error);
    }
  }

  async addWallet(wallet: Wallet): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        const { id, address } = wallet.account;
        if (
          this.isAccountExist(
            state,
            id,
          ) ||
          this.getAccountByAddress(state, address)
        ) {
          throw new StateError(`Account address ${address} already exists`);
        }

        state.wallets[id] = wallet;
        state.accounts.push(id);
      });
    } catch (error) {
      if (error instanceof StateError) {
        throw error;
      }
      throw new StateError(error);
    }
  }

  async updateAccount(account: KeyringAccount): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        if (
          !this.isAccountExist(
            state,
            account.id,
          )
        ) {
          throw new StateError(`Account id ${account.id} does not exist`);
        }

        state.accounts.push(account.id);
        const wallet = state.wallets[account.id]
        state.wallets[account.id] = {
          ...wallet,
          account: {
            ...wallet.account,
            ...account,
          }
        };
      });
    } catch (error) {
      if (error instanceof StateError) {
        throw error;
      }
      throw new StateError(error);
    }
  }

  async removeAccounts(ids: string[]): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        const removeIds = new Set<string>();

        for (const id of ids) {
          if (!this.isAccountExist(state, id)) {
            throw new StateError(`Account id ${id} does not exist`);
          }
          removeIds.add(id);
        }

        removeIds.forEach((id) => delete state.wallets[id]);
        state.accounts = state.accounts.filter((id) => !removeIds.has(id));
      });
    } catch (error) {
      if (error instanceof StateError) {
        throw error;
      }
      throw new StateError(error);
    }
  }

  async getAccount(id: string): Promise<KeyringAccount | null> {
    try {
      const state = await this.get();

      if (!this.isAccountExist(state, id)) {
        return null;
      }

      return state.wallets[id].account as unknown as KeyringAccount;
    } catch (error) {
      throw new StateError(error);
    }
  }

  protected getAccountByAddress(state: SnapState, address:string): KeyringAccount | null  {
    return Object.values(state.wallets).find((wallet) => wallet.account.address.toString() === address.toLowerCase())?.account ?? null;
  }

  protected isAccountExist(state:SnapState, id: string): boolean {
    return Object.prototype.hasOwnProperty.call(
      state.wallets,
      id,
    );
  }
}
