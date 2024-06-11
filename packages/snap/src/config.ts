import type { Json } from '@metamask/snaps-sdk';

import { Network as BtcNetwork, BtcAsset, BtcUnit } from './bitcoin/constants';

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
  avaliableNetworks: Object.values(BtcNetwork),
  avaliableAssets: Object.values(BtcAsset),
  unit: BtcUnit.Btc,
  explorer: {
    // eslint-disable-next-line no-template-curly-in-string
    [BtcNetwork.Mainnet]: 'https://blockstream.info/address/${address}',
    // eslint-disable-next-line no-template-curly-in-string
    [BtcNetwork.Testnet]: 'https://blockstream.info/testnet/address/${address}',
  },
  // eslint-disable-next-line no-restricted-globals
  logLevel: process.env.LOG_LEVEL ?? '6',
};
