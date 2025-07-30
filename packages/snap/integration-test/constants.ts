import { BtcAccountType, BtcScope } from '@metamask/keyring-api';

import { CurrencyUnit } from '../src/entities';
import { Caip19Asset } from '../src/handlers/caip';

export const MNEMONIC =
  'journey embrace permit coil indoor stereo welcome maid movie easy clock spider tent slush bright luxury awake waste legal modify awkward answer acid goose';
export const TEST_ADDRESS_REGTEST =
  'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t';
export const TEST_ADDRESS_MAINNET =
  'bc1q832zlt4tgnqy88vd20mazw77dlt0j0wf2naw8q';
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
      address: TEST_ADDRESS_REGTEST,
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

export const accountTypeToPurpose: Record<BtcAccountType, string> = {
  [BtcAccountType.P2pkh]: "44'",
  [BtcAccountType.P2sh]: "49'",
  [BtcAccountType.P2wpkh]: "84'",
  [BtcAccountType.P2tr]: "86'",
};

export const scopeToCoinType: Record<BtcScope, string> = {
  [BtcScope.Mainnet]: "0'",
  [BtcScope.Testnet]: "1'",
  [BtcScope.Testnet4]: "1'",
  [BtcScope.Signet]: "1'",
  [BtcScope.Regtest]: "1'",
};
