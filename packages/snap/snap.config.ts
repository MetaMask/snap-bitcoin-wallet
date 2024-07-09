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
    BLOCKCHAIR_API_KEY: process.env.BLOCKCHAIR_API_KEY,
    /* eslint-disable */
  },
  polyfills: true,
};

export default config;
