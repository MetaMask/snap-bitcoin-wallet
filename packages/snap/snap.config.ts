import type { SnapConfig } from '@metamask/snaps-cli';
import { resolve } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-var-requires
require('dotenv').config();

const config: SnapConfig = {
  bundler: 'webpack',
  input: resolve(__dirname, 'src/index.tsx'),
  server: {
    port: 8080,
  },
  environment: {
    /* eslint-disable */
    LOG_LEVEL: process.env.LOG_LEVEL,
    QUICKNODE_MAINNET_ENDPOINT: process.env.QUICKNODE_MAINNET_ENDPOINT,
    QUICKNODE_TESTNET_ENDPOINT: process.env.QUICKNODE_TESTNET_ENDPOINT,
    SIMPLEHASH_API_KEY: process.env.SIMPLEHASH_API_KEY,
    /* eslint-disable */
  },
  polyfills: true,
  experimental: {wasm: true},
};

export default config;
