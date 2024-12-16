/* eslint-disable no-restricted-globals */

import { Network } from '@dario_nakamoto/bdk/bdk_wasm_bg';

import type { SnapConfig } from './entities';
import { Caip2AddressType, Caip2ChainId } from './handlers';

export const ConfigV2: SnapConfig = {
  encrypt: false,
  keyringVersion: process.env.KEYRING_VERSION ?? 'v1',
  accounts: {
    index: 0,
    defaultNetwork: process.env.DEFAULT_NETWORK ?? Caip2ChainId.Bitcoin,
    defaultAddressType:
      process.env.DEFAULT_ADDRESS_TYPE ?? Caip2AddressType.P2wpkh,
  },
  chain: {
    parallelRequests: 1,
    stopGap: 10,
    url: {
      [Network.Bitcoin]:
        process.env.ESPLORA_PROVIDER_BITCOIN ?? 'https://blockstream.info/api',
      [Network.Testnet]:
        process.env.ESPLORA_PROVIDER_TESTNET ??
        'https://blockstream.info/testnet/api',
      [Network.Testnet4]:
        process.env.ESPLORA_PROVIDER_TESTNET4 ??
        'https://mempool.space/testnet4/api/v1',
      [Network.Signet]:
        process.env.ESPLORA_PROVIDER_SIGNET ?? 'https://mutinynet.com/api',
      [Network.Regtest]:
        process.env.ESPLORA_PROVIDER_REGTEST ?? 'https://localhost:3000',
    },
  },
};
