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
    QN_MAINNET_ENDPOINT: process.env.QN_MAINNET_ENDPOINT,
    QN_TESTNET_ENDPOINT: process.env.QN_TESTNET_ENDPOINT,
    /* eslint-disable */
  },
  polyfills: true,
};

export default config;
