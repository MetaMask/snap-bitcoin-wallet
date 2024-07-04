import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { getScriptForDestnation } from './address';

describe('address', () => {
  const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  describe('getScriptForDestnation', () => {
    it('returns a script', () => {
      const val = getScriptForDestnation(address, networks.testnet);
      expect(val).toBeInstanceOf(Buffer);
    });

    it('throws `Destnation address has no matching Script` error if the given address is invalid', () => {
      expect(() =>
        getScriptForDestnation('bad-address', networks.testnet),
      ).toThrow(`Destnation address has no matching Script`);
    });
  });
});
