/* eslint-disable no-restricted-globals */

import type { AddressType } from '@metamask/bitcoindevkit';

import { LogLevel, type SnapConfig } from './entities';

export const Config: SnapConfig = {
  logLevel: (process.env.LOG_LEVEL ?? LogLevel.INFO) as LogLevel,
  encrypt: false,
  chain: {
    parallelRequests: 2,
    stopGap: 5,
    url: {
      bitcoin: process.env.ESPLORA_BITCOIN ?? 'https://blockstream.info/api',
      testnet:
        process.env.ESPLORA_TESTNET ?? 'https://blockstream.info/testnet/api',
      testnet4:
        process.env.ESPLORA_TESTNET4 ?? 'https://mempool.space/testnet4/api/v1',
      signet: process.env.ESPLORA_SIGNET ?? 'https://mutinynet.com/api',
      regtest:
        process.env.ESPLORA_REGTEST ?? 'http://localhost:8094/regtest/api',
    },
  },
  targetBlocksConfirmation: 3,
  fallbackFeeRate: 5.0,
  ratesRefreshInterval: 'PT30S',
  priceApi: {
    url: process.env.PRICE_API_URL ?? 'https://price.api.cx.metamask.io',
  },
  conversionsExpirationInterval: 60,
  defaultAddressType: (process.env.DEFAULT_ADDRESS_TYPE ??
    'p2wpkh') as AddressType,
};
