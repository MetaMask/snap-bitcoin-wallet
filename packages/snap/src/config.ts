import type { Json } from '@metamask/snaps-sdk';

import {
  Network as BtcNetwork,
  DataClient,
  BtcAsset,
  BtcUnit,
} from './bitcoin/constants';

export type BtcOnChainServiceConfig = {
  dataClient: {
    read: {
      type: DataClient;
      options?: Record<string, Json | undefined>;
    };
    write: {
      type: DataClient;
      options?: Record<string, Json | undefined>;
    };
  };
};

export type BtcWalletConfig = {
  defaultAccountIndex: number;
  defaultAccountType: string;
};

export enum Chain {
  Bitcoin = 'Bitcoin',
}

export type NetworkConfig = {
  [key in string]: string;
};

export type SnapConfig = {
  onChainService: BtcOnChainServiceConfig;
  wallet: BtcWalletConfig;
  avaliableNetworks: string[];
  avaliableAssets: string[];
  unit: string;
  explorer: {
    [network in string]: string;
  };
  chain: Chain;
  logLevel: string;
};

export const Config: SnapConfig = {
  onChainService: {
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

      write: {
        type:
          // eslint-disable-next-line no-restricted-globals
          (process.env.DATA_CLIENT_WRITE_TYPE as DataClient) ??
          DataClient.BlockChair,
        options: {
          // eslint-disable-next-line no-restricted-globals
          apiKey: process.env.BLOCKCHAIR_API_KEY,
        },
      },
    },
  },
  wallet: {
    defaultAccountIndex: 0,
    defaultAccountType: 'bip122:p2wpkh',
  },
  avaliableNetworks: Object.values(BtcNetwork),
  avaliableAssets: Object.values(BtcAsset),
  unit: BtcUnit.Btc,
  explorer: {
    [BtcNetwork.Mainnet]: 'https://blockstream.info',
    [BtcNetwork.Testnet]: 'https://blockstream.info/testnet',
  },
  chain: Chain.Bitcoin,
  // eslint-disable-next-line no-restricted-globals
  logLevel: process.env.LOG_LEVEL ?? '6',
};
