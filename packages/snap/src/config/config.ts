import type {
  BtcWalletConfig,
  BtcOnChainServiceConfig,
} from '../modules/bitcoin/config';
import {
  Network as BtcNetwork,
  DataClient,
  BtcAsset,
  BtcUnit,
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
  unit: {
    [key in Chain]: string;
  };
  explorer: {
    [key in Chain]: {
      [network in string]: string;
    };
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
  unit: {
    [Chain.Bitcoin]: BtcUnit.Btc,
  },
  explorer: {
    [Chain.Bitcoin]: {
      [BtcNetwork.Mainnet]: 'https://blockstream.info',
      [BtcNetwork.Testnet]: 'https://blockstream.info/testnet',
    },
  },
  chain: Chain.Bitcoin,
  // eslint-disable-next-line no-restricted-globals
  logLevel: process.env.LOG_LEVEL ?? '6',
};
