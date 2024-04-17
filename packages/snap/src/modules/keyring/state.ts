import type { KeyringAccount } from '@metamask/keyring-api';

import { type SnapState } from '../../types/state';
import { SnapStateManager, StateError } from '../snap';

export class KeyringStateManager extends SnapStateManager<SnapState> {
  protected override async get(): Promise<SnapState> {
    return super.get().then((state: SnapState) => {
      if (!state) {
        // eslint-disable-next-line no-param-reassign
        state = {
          accounts: [],
          accountDetails: {},
        };
      }

      if (!state.accounts) {
        state.accounts = [];
      }

      if (!state.accountDetails) {
        state.accountDetails = {};
      }

      return state;
    });
  }

  async listAccounts() {
    try {
      const state = await this.get();
      return state.accounts.map((id) => state.accountDetails[id]);
    } catch (error) {
      throw new StateError(error);
    }
  }

  async saveAccount(account: KeyringAccount): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        if (
          !Object.prototype.hasOwnProperty.call(
            state.accountDetails,
            account.id,
          )
        ) {
          state.accounts.push(account.id);
        }

        state.accountDetails[account.id] = account;
      });
    } catch (error) {
      throw new StateError(error);
    }
  }

  async removeAccounts(ids: string[]): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        const removeIds = new Set<string>();

        for (const id of ids) {
          if (!Object.prototype.hasOwnProperty.call(state.accountDetails, id)) {
            throw new StateError(`Account with id ${id} does not exist`);
          }
          removeIds.add(id);
        }

        removeIds.forEach((id) => delete state.accountDetails[id]);
        state.accounts = state.accounts.filter((id) => !removeIds.has(id));
      });
    } catch (error) {
      throw new StateError(error);
    }
  }

  async getAccount(id: string): Promise<KeyringAccount | null> {
    try {
      const state = await this.get();

      if (!Object.prototype.hasOwnProperty.call(state.accountDetails, id)) {
        return null;
      }

      return state.accountDetails[id];
    } catch (error) {
      throw new StateError(error);
    }
  }

  async getAccountByAddress(address: string): Promise<KeyringAccount | null> {
    try {
      const state = await this.get();
      return (
        Object.values(state.accountDetails).find(
          (account) => account.address.toLowerCase() === address.toLowerCase(),
        ) ?? null
      );
    } catch (error) {
      throw new StateError(error);
    }
  }
}
