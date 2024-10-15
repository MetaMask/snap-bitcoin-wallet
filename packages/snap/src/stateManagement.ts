import type { KeyringAccount } from '@metamask/keyring-api';

import { type EstimateFeeResponse, type SendManyParams } from './rpcs';
import type { AssetType, Currency } from './ui/types';
import { compactError, SnapStateManager } from './utils';

export type Wallet = {
  account: KeyringAccount;
  hdPath: string;
  index: number;
  scope: string;
};

export type Wallets = Record<string, Wallet>;

export type SendEstimate = {
  // The estimated fee in BTC.
  fees: EstimateFeeResponse & { loading: boolean };
  // The estimated time to confirmation time.
  confirmationTime: string;
};

export type Transaction = SendManyParams & {
  sender: string;
  recipient: string;
  amount: string;
  total: string;
};

export type BaseRequestState = {
  id: string;
  interfaceId: string;
  account: KeyringAccount;
  scope: string;
};

export type SendFlowParams = {
  selectedCurrency: AssetType;
  recipient: {
    address: string;
    error: string;
    valid: boolean;
  };
  fees: Currency & { loading: boolean; error: string };
  amount: Currency & { error: string; valid: boolean };
  rates: string;
  balance: Currency; // TODO: To be removed once metadata is available
  total: Currency & { error: string; valid: boolean };
};

export enum TransactionStatus {
  Draft = 'draft',
  Review = 'review',
  Signed = 'signed',
  Rejected = 'rejected',
  Confirmed = 'confirmed',
  Pending = 'pending',
  Failure = 'failure',
}

export type TransactionState = {
  transaction: Omit<SendManyParams, 'scope'>;
  /* The status of the transaction 
    - draft: The transaction is being created and edited
    - review: The transaction is in a review state that is ready to be confirmed by the user to sign
    - signed: The transaction is signed and ready to be sent
    - rejected: The transaction is rejected by the user
    - confirmed: The transaction is confirmed by the network
    - pending: The transaction is pending confirmation
    - failure: The transaction failed
  */
  status: TransactionStatus;
  txId?: string;
};

export type SendFlowRequest = BaseRequestState &
  SendFlowParams &
  TransactionState;

export type SnapState = {
  walletIds: string[];
  wallets: Wallets;
  requests: {
    [id: string]: SendFlowRequest;
  };
};

export class KeyringStateManager extends SnapStateManager<SnapState> {
  protected override async get(): Promise<SnapState> {
    return super.get().then((state: SnapState) => {
      if (!state) {
        // eslint-disable-next-line no-param-reassign
        state = {
          walletIds: [],
          wallets: {},
          requests: {},
        };
      }

      if (!state.walletIds) {
        state.walletIds = [];
      }

      if (!state.wallets) {
        state.wallets = {};
      }

      if (!state.requests) {
        state.requests = {};
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

  async getRequest(id: string): Promise<SendFlowRequest | null> {
    try {
      const state = await this.get();
      return state.requests[id] ?? null;
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  async upsertRequest(sendFlowRequest: SendFlowRequest): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        state.requests[sendFlowRequest.id] = {
          ...state.requests[sendFlowRequest.id],
          ...sendFlowRequest,
        };
      });
    } catch (error) {
      throw compactError(error, Error);
    }
  }

  async removeRequest(id: string): Promise<void> {
    try {
      await this.update(async (state: SnapState) => {
        if (state.requests[id]) {
          delete state.requests[id];
        }
      });
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

  protected isRequestExist(state: SnapState, id: string): boolean {
    return Object.prototype.hasOwnProperty.call(state.requests, id);
  }
}
