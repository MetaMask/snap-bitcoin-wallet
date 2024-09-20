import type { Json } from '@metamask/snaps-sdk';

import { FeeRate } from './bitcoin/chain/constants';
import { Caip2ChainId, Caip2Asset } from './constants';

export type SnapConfig = {
  onChainService: {
    dataClient: {
      options?: Record<string, Json | undefined>;
    };
  };
  wallet: {
    defaultAccountIndex: number;
    defaultAccountType: string;
  };
  availableNetworks: string[];
  availableAssets: string[];
  defaultFeeRate: FeeRate;
  unit: string;
  explorer: {
    [network in string]: string;
  };
  logLevel: string;
  defaultConfirmationThreshold: number;
};

export const Config: SnapConfig = {
  onChainService: {
    dataClient: {
      options: {
        // eslint-disable-next-line no-restricted-globals
        testnetEndpoint: process.env.QN_TESTNET_ENDPOINT,
        // eslint-disable-next-line no-restricted-globals
        mainnetEndpoint: process.env.QN_MAINNET_ENDPOINT,
      },
    },
  },
  wallet: {
    defaultAccountIndex: 0,
    defaultAccountType: 'bip122:p2wpkh',
  },
  availableNetworks: Object.values(Caip2ChainId),
  availableAssets: Object.values(Caip2Asset),
  defaultFeeRate: FeeRate.Medium,
  unit: 'BTC',
  explorer: {
    // eslint-disable-next-line no-template-curly-in-string
    [Caip2ChainId.Mainnet]: 'https://blockstream.info/address/${address}',
    [Caip2ChainId.Testnet]:
      // eslint-disable-next-line no-template-curly-in-string
      'https://blockstream.info/testnet/address/${address}',
  },
  // eslint-disable-next-line no-restricted-globals
  logLevel: process.env.LOG_LEVEL ?? '0',
  // the number of confirmations required for a transaction to be considered confirmed
  defaultConfirmationThreshold: 6,
};
