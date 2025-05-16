import type { SnapConfig } from '@metamask/snaps-cli';
import { config as dotenv } from 'dotenv';
import { resolve } from 'path';

dotenv();

const config: SnapConfig = {
  input: resolve(__dirname, 'src/index.ts'),
  server: {
    port: 8080,
  },
  environment: {
    LOG_LEVEL: process.env.LOG_LEVEL,
    DEFAULT_ADDRESS_TYPE: process.env.DEFAULT_ADDRESS_TYPE,
    ESPLORA_BITCOIN: process.env.ESPLORA_BITCOIN,
    ESPLORA_TESTNET: process.env.ESPLORA_TESTNET,
    ESPLORA_TESTNET4: process.env.ESPLORA_TESTNET4,
    ESPLORA_SIGNET: process.env.ESPLORA_SIGNET,
    ESPLORA_REGTEST: process.env.ESPLORA_REGTEST,
    PRICE_API_URL: process.env.PRICE_API_URL,
  },
  polyfills: true,
  experimental: { wasm: true },
};

export default config;
