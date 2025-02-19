import type { SnapConfig } from '@metamask/snaps-cli';
import { resolve } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
require('dotenv').config();

const config: SnapConfig = {
  bundler: 'webpack',
  input: resolve(__dirname, 'src/index.ts'),
  server: {
    port: 8080,
  },
  environment: {
    /* eslint-disable */
    LOG_LEVEL: process.env.LOG_LEVEL,
    DEFAULT_NETWORK: process.env.DEFAULT_NETWORK,
    DEFAULT_ADDRESS_TYPE: process.env.DEFAULT_ADDRESS_TYPE,
    ESPLORA_BITCOIN: process.env.ESPLORA_BITCOIN,
    ESPLORA_TESTNET: process.env.ESPLORA_TESTNET,
    ESPLORA_TESTNET4: process.env.ESPLORA_TESTNET4,
    ESPLORA_SIGNET: process.env.ESPLORA_SIGNET,
    ESPLORA_REGTEST: process.env.ESPLORA_REGTEST,
    SIMPLEHASH_BITCOIN: process.env.SIMPLEHASH_BITCOIN,
    SIMPLEHASH_API_KEY: process.env.SIMPLEHASH_API_KEY,
    /* eslint-disable */
  },
  polyfills: true,
  experimental: { wasm: true },
};

export default config;
