import type { Json } from '@metamask/snaps-sdk';

import { Caip2ChainId, Caip2Asset } from './constants';

export type BtcOnChainServiceConfig = {
  dataClient: {
    options?: Record<string, Json | undefined>;
  };
};

export type BtcWalletConfig = {
  defaultAccountIndex: number;
  defaultAccountType: string;
};

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
  logLevel: string;
};

export const Config: SnapConfig = {
  onChainService: {
    dataClient: {
      options: {
        // eslint-disable-next-line no-restricted-globals
        apiKey: process.env.BLOCKCHAIR_API_KEY,
      },
    },
  },
  wallet: {
    defaultAccountIndex: 0,
    defaultAccountType: 'bip122:p2wpkh',
  },
  avaliableNetworks: Object.values(Caip2ChainId),
  avaliableAssets: Object.values(Caip2Asset),
  unit: 'BTC',
  explorer: {
    // eslint-disable-next-line no-template-curly-in-string
    [Caip2ChainId.Mainnet]: 'https://blockstream.info/address/${address}',
    [Caip2ChainId.Testnet]:
      // eslint-disable-next-line no-template-curly-in-string
      'https://blockstream.info/testnet/address/${address}',
  },
  // eslint-disable-next-line no-restricted-globals
  logLevel: process.env.LOG_LEVEL ?? '6',
};
