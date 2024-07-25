import type { Json } from '@metamask/snaps-sdk';

import { FeeRatio } from './bitcoin/chain/constants';
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
  defaultFeeRate: FeeRatio;
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
  availableNetworks: Object.values(Caip2ChainId),
  availableAssets: Object.values(Caip2Asset),
  defaultFeeRate: FeeRatio.Medium,
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
};
