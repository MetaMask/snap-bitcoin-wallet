import type {
  BtcWalletConfig,
  BtcOnChainServiceConfig,
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

export type OnChainServiceConfig = {
  [Chain.Bitcoin]: BtcOnChainServiceConfig;
};

export type WalletConfig = {
  [Chain.Bitcoin]: BtcWalletConfig;
};

export type SnapConfig = {
  onChainService: OnChainServiceConfig;
  wallet: WalletConfig;
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
  onChainService: {
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
  wallet: {
    [Chain.Bitcoin]: {
      enableMultiAccounts: false,
      defaultAccountIndex: 0,
      defaultAccountType: 'bip122:p2wpkh',
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
