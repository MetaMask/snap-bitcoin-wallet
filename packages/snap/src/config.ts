import { FeeRate } from './bitcoin/chain/constants';
import { Caip2ChainId, Caip19Asset } from './constants';

export enum ApiClient {
  QuickNode = 'QuickNode',
  SimpleHash = 'SimpleHash',
}

export type SnapChainConfig = {
  onChainService: {
    apiClient: {
      [ApiClient.QuickNode]: {
        options: {
          mainnetEndpoint: string | undefined;
          testnetEndpoint: string | undefined;
        };
      };
      [ApiClient.SimpleHash]: {
        options: {
          apiKey: string | undefined;
        };
      };
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
  defaultSatsProtectionEnabled: boolean;
};

export const Config: SnapChainConfig = {
  onChainService: {
    apiClient: {
      [ApiClient.QuickNode]: {
        options: {
          // eslint-disable-next-line no-restricted-globals
          testnetEndpoint: process.env.QUICKNODE_TESTNET_ENDPOINT,
          // eslint-disable-next-line no-restricted-globals
          mainnetEndpoint: process.env.QUICKNODE_MAINNET_ENDPOINT,
        },
      },
      [ApiClient.SimpleHash]: {
        options: {
          // eslint-disable-next-line no-restricted-globals
          apiKey: process.env.SIMPLEHASH_API_KEY,
        },
      },
    },
  },
  wallet: {
    defaultAccountIndex: 0,
    defaultAccountType: 'bip122:p2wpkh',
  },
  availableNetworks: Object.values(Caip2ChainId),
  availableAssets: Object.values(Caip19Asset),
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
  defaultSatsProtectionEnabled: true,
};
