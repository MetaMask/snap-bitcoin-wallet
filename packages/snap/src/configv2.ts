/* eslint-disable no-restricted-globals */

import { BtcScopes } from '@metamask/keyring-api';

import type { SnapConfig } from './entities';
import { Caip2AddressType } from './handlers';

// ConfigV2 exists temporarily to avoid modifying the old config object before it is removed.
export const ConfigV2: SnapConfig = {
  encrypt: false,
  // Defaults to v1 to use the "original" keyring.
  keyringVersion: process.env.KEYRING_VERSION ?? 'v1',
  accounts: {
    index: 0,
    defaultNetwork: process.env.DEFAULT_NETWORK ?? BtcScopes.Mainnet,
    defaultAddressType:
      process.env.DEFAULT_ADDRESS_TYPE ?? Caip2AddressType.P2wpkh,
  },
  chain: {
    parallelRequests: 1,
    stopGap: 10,
    url: {
      bitcoin:
        process.env.ESPLORA_PROVIDER_BITCOIN ?? 'https://blockstream.info/api',
      testnet:
        process.env.ESPLORA_PROVIDER_TESTNET ??
        'https://blockstream.info/testnet/api',
      testnet4:
        process.env.ESPLORA_PROVIDER_TESTNET4 ??
        'https://mempool.space/testnet4/api/v1',
      signet:
        process.env.ESPLORA_PROVIDER_SIGNET ?? 'https://mutinynet.com/api',
      regtest:
        process.env.ESPLORA_PROVIDER_REGTEST ??
        'http://localhost:8094/regtest/api',
    },
  },
};
