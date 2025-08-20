/* eslint-disable no-restricted-globals */

import type { AddressType } from '@metamask/bitcoindevkit';

import { LogLevel, type SnapConfig } from './entities';

export const Config: SnapConfig = {
  logLevel: envOrDefault('LOG_LEVEL', LogLevel.INFO) as LogLevel,
  encrypt: false,
  chain: {
    parallelRequests: 5,
    stopGap: 10,
    maxRetries: 3,
    url: {
      bitcoin: envOrDefault('ESPLORA_BITCOIN', 'https://blockstream.info/api'),
      testnet: envOrDefault(
        'ESPLORA_TESTNET',
        'https://blockstream.info/testnet/api',
      ),
      testnet4: envOrDefault(
        'ESPLORA_TESTNET4',
        'https://mempool.space/testnet4/api/v1',
      ),
      signet: envOrDefault('ESPLORA_SIGNET', 'https://mutinynet.com/api'),
      regtest: envOrDefault(
        'ESPLORA_REGTEST',
        'http://localhost:8094/regtest/api',
      ),
    },
    explorerUrl: {
      bitcoin: envOrDefault('BITCOIN_EXPLORER', 'https://mempool.space'),
      testnet: envOrDefault(
        'TESTNET_EXPLORER',
        'https://mempool.space/testnet',
      ),
      testnet4: envOrDefault(
        'TESTNET4_EXPLORER',
        'https://mempool.space/testnet4',
      ),
      signet: envOrDefault('SIGNET_EXPLORER', 'https://mutinynet.com'),
      regtest: envOrDefault(
        'REGTEST_EXPLORER',
        'http://localhost:8094/regtest',
      ),
    },
  },
  targetBlocksConfirmation: 3,
  fallbackFeeRate: 5.0,
  ratesRefreshInterval: 'PT20S',
  priceApi: {
    url: envOrDefault('PRICE_API_URL', 'https://price.api.cx.metamask.io'),
  },
  conversionsExpirationInterval: 60,
  defaultAddressType: envOrDefault(
    'DEFAULT_ADDRESS_TYPE',
    'p2wpkh',
  ) as AddressType,
};

function envOrDefault(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() !== '' ? v : fallback;
}
