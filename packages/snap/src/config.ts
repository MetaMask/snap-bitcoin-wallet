/* eslint-disable no-restricted-globals */

import type { AddressType } from '@bitcoindevkit/bdk-wallet-web';

import { LogLevel, type SnapConfig } from './entities';

const ENV = {
  LOG_LEVEL: process.env.LOG_LEVEL,
  DEFAULT_ADDRESS_TYPE: process.env.DEFAULT_ADDRESS_TYPE,
  ESPLORA_BITCOIN: process.env.ESPLORA_BITCOIN,
  ESPLORA_TESTNET: process.env.ESPLORA_TESTNET,
  ESPLORA_TESTNET4: process.env.ESPLORA_TESTNET4,
  ESPLORA_SIGNET: process.env.ESPLORA_SIGNET,
  ESPLORA_REGTEST: process.env.ESPLORA_REGTEST,
  PRICE_API_URL: process.env.PRICE_API_URL,
  BITCOIN_EXPLORER: process.env.BITCOIN_EXPLORER,
  TESTNET_EXPLORER: process.env.TESTNET_EXPLORER,
  TESTNET4_EXPLORER: process.env.TESTNET4_EXPLORER,
  SIGNET_EXPLORER: process.env.SIGNET_EXPLORER,
  REGTEST_EXPLORER: process.env.REGTEST_EXPLORER,
} as const;

const fromEnv = (key: string, fallback: string): string => {
  const value = ENV[key as keyof typeof ENV];
  return value && value.trim() !== '' ? value : fallback;
};

export const Config: SnapConfig = {
  logLevel: fromEnv('LOG_LEVEL', LogLevel.INFO) as LogLevel,
  encrypt: false,
  chain: {
    parallelRequests: 5,
    stopGap: 5,
    maxRetries: 3,
    url: {
      bitcoin: fromEnv('ESPLORA_BITCOIN', 'https://blockstream.info/api'),
      testnet: fromEnv(
        'ESPLORA_TESTNET',
        'https://blockstream.info/testnet/api',
      ),
      testnet4: fromEnv(
        'ESPLORA_TESTNET4',
        'https://mempool.space/testnet4/api/v1',
      ),
      signet: fromEnv('ESPLORA_SIGNET', 'https://mutinynet.com/api'),
      regtest: fromEnv('ESPLORA_REGTEST', 'http://localhost:8094/regtest/api'),
    },
    explorerUrl: {
      bitcoin: fromEnv('BITCOIN_EXPLORER', 'https://mempool.space'),
      testnet: fromEnv('TESTNET_EXPLORER', 'https://mempool.space/testnet'),
      testnet4: fromEnv('TESTNET4_EXPLORER', 'https://mempool.space/testnet4'),
      signet: fromEnv('SIGNET_EXPLORER', 'https://mutinynet.com'),
      regtest: fromEnv('REGTEST_EXPLORER', 'http://localhost:8094/regtest'),
    },
  },
  targetBlocksConfirmation: 1,
  fallbackFeeRate: 5.0,
  ratesRefreshInterval: 'PT20S',
  priceApi: {
    url: fromEnv('PRICE_API_URL', 'https://price.api.cx.metamask.io'),
  },
  conversionsExpirationInterval: 60,
  defaultAddressType: fromEnv('DEFAULT_ADDRESS_TYPE', 'p2wpkh') as AddressType,
};
