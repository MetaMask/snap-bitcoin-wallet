import type {
  BtcAccountConfig,
  BtcTransactionConfig,
} from '../modules/bitcoin/config';
import {
  Network as BtcNetwork,
  DataClient,
  BtcAsset,
} from '../modules/bitcoin/constants';

export enum Chain {
  Bitcoin = 'Bitcoin',
}

export type NetworkConfig = {
  [key in string]: string;
};

export type TransactionConfig = {
  [Chain.Bitcoin]: BtcTransactionConfig;
};

export type AccountConfig = {
  [Chain.Bitcoin]: BtcAccountConfig;
};

export type SnapConfig = {
  transaction: TransactionConfig;
  account: AccountConfig;
  avaliableNetworks: {
    [key in Chain]: string[];
  };
  avaliableAssets: {
    [key in Chain]: string[];
  };
  chain: Chain;
  logLevel: string;
};

export const Config: SnapConfig = {
  transaction: {
    [Chain.Bitcoin]: {
      dataClient: {
        read: {
          type:
            // eslint-disable-next-line no-restricted-globals
            (process.env.DATA_CLIENT_READ_TYPE as DataClient) ??
            DataClient.BlockChair,
          options: {
            // eslint-disable-next-line no-restricted-globals
            apiKey: process.env.BLOCKCHAIR_API_KEY,
          },
        },
      },
    },
  },
  account: {
    [Chain.Bitcoin]: {
      enableMultiAccounts: false,
      defaultAccountIndex: 0,
      defaultAccountType: 'p2wpkh',
      deriver: 'BIP32',
    },
  },
  avaliableNetworks: {
    [Chain.Bitcoin]: Object.values(BtcNetwork),
  },
  avaliableAssets: {
    [Chain.Bitcoin]: Object.values(BtcAsset),
  },
  chain: Chain.Bitcoin,
  // eslint-disable-next-line no-restricted-globals
  logLevel: process.env.LOG_LEVEL ?? '6',
};
