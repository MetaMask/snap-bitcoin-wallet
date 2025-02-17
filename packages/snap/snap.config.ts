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
    QUICKNODE_MAINNET_ENDPOINT: process.env.QUICKNODE_MAINNET_ENDPOINT,
    QUICKNODE_TESTNET_ENDPOINT: process.env.QUICKNODE_TESTNET_ENDPOINT,
    SIMPLEHASH_API_KEY: process.env.SIMPLEHASH_API_KEY,
    DEFAULT_NETWORK: process.env.DEFAULT_NETWORK,
    DEFAULT_ADDRESS_TYPE: process.env.DEFAULT_ADDRESS_TYPE,
    ESPLORA_PROVIDER_BITCOIN: process.env.ESPLORA_PROVIDER_BITCOIN,
    ESPLORA_PROVIDER_TESTNET: process.env.ESPLORA_PROVIDER_TESTNET,
    ESPLORA_PROVIDER_TESTNET4: process.env.ESPLORA_PROVIDER_TESTNET4,
    ESPLORA_PROVIDER_SIGNET: process.env.ESPLORA_PROVIDER_SIGNET,
    ESPLORA_PROVIDER_REGTEST: process.env.ESPLORA_PROVIDER_REGTEST,
    KEYRING_VERSION: process.env.KEYRING_VERSION,
    METAPROTOCOLS_PROVIDER_BITCOIN: process.env.METAPROTOCOLS_PROVIDER_BITCOIN,
    /* eslint-disable */
  },
  polyfills: true,
  experimental: { wasm: true },
};

export default config;
