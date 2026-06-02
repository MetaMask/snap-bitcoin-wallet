import type { AddressType } from '@metamask/bitcoindevkit';

import { canAccountTxidBeMalleated } from './account';

describe('canAccountTxidBeMalleated', () => {
  it.each<[AddressType, boolean]>([
    ['p2pkh', true],
    ['p2sh', false],
    ['p2wpkh', false],
    ['p2wsh', false],
    ['p2tr', false],
  ])('returns %s -> %s', (addressType, expected) => {
    expect(canAccountTxidBeMalleated(addressType)).toBe(expected);
  });
});
