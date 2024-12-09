import { Network } from 'bdk_wasm';

import { Caip2AddressType, Caip2ChainId } from './entities';

export type SnapConfig = {
  accounts: AccountsConfig;
  chain: ChainConfig;
  keyringVersion: string;
};

export type AccountsConfig = {
  accountIndex: number;
  defaultNetwork: string;
  defaultAddressType: string;
};

export type ChainConfig = {
  parallelRequests: number;
  stopGap: number;
  url: {
    [network in Network]: string;
  };
};

export const ConfigV2: SnapConfig = {
  keyringVersion: process.env.KEYRING_VERSION ?? 'v1',
  accounts: {
    accountIndex: 0,
    defaultNetwork: process.env.DEFAULT_NETWORK ?? Caip2ChainId.Bitcoin,
    defaultAddressType:
      process.env.DEFAULT_ADDRESS_TYPE ?? Caip2AddressType.P2wpkh,
  },
  chain: {
    parallelRequests: 1,
    stopGap: 10,
    url: {
      [Network.Bitcoin]:
        process.env.ESPLORA_PROVIDER_BITCOIN ?? 'https://blockstream.info/api',
      [Network.Testnet]:
        process.env.ESPLORA_PROVIDER_TESTNET ??
        'https://blockstream.info/testnet/api',
      [Network.Testnet4]:
        process.env.ESPLORA_PROVIDER_TESTNET4 ??
        'https://mempool.space/testnet4/api/v1',
      [Network.Signet]:
        process.env.ESPLORA_PROVIDER_SIGNET ?? 'https://mutinynet.com/api',
      [Network.Regtest]:
        process.env.ESPLORA_PROVIDER_REGTEST ?? 'https://localhost:3000',
    },
  },
};
