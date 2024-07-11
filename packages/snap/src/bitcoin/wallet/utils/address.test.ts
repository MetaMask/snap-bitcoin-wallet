import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { getScriptForDestination } from './address';

describe('address', () => {
  const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  describe('getScriptForDestination', () => {
    it('returns a script', () => {
      const val = getScriptForDestination(address, networks.testnet);
      expect(val).toBeInstanceOf(Buffer);
    });

    it('throws `Destination address has no matching Script` error if the given address is invalid', () => {
      expect(() =>
        getScriptForDestination('bad-address', networks.testnet),
      ).toThrow(`Destination address has no matching Script`);
    });
  });
});
