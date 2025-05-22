import { BtcScope } from '@metamask/keyring-api';

import { CurrencyUnit } from '../src/entities';
import { Caip19Asset } from '../src/handlers/caip';

export const MNEMONIC =
  'journey embrace permit coil indoor stereo welcome maid movie easy clock spider tent slush bright luxury awake waste legal modify awkward answer acid goose';
export const TEST_ADDRESS = 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t';
export const ORIGIN = 'metamask';
export const FUNDING_TX = {
  account: expect.any(Number),
  chain: BtcScope.Regtest,
  events: [
    { status: 'unconfirmed', timestamp: null },
    { status: 'confirmed', timestamp: expect.any(Number) },
  ],
  fees: [],
  from: [],
  id: expect.any(String),
  status: 'confirmed',
  timestamp: expect.any(Number),
  to: [
    {
      address: TEST_ADDRESS,
      asset: {
        amount: '500',
        fungible: true,
        type: Caip19Asset.Regtest,
        unit: CurrencyUnit.Regtest,
      },
    },
  ],
  type: 'receive',
};
