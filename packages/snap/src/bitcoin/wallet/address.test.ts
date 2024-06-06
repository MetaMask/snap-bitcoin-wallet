import { BtcAddress } from './address';

describe('BtcAddress', () => {
  const address = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';

  describe('toString', () => {
    it('returns a address', async () => {
      const val = new BtcAddress(address);
      expect(val.toString()).toStrictEqual(address);
    });

    it('returns a shortern address', async () => {
      const val = new BtcAddress(address);
      expect(val.toString(true)).toBe('tb1qt...aeu');
    });
  });
});
