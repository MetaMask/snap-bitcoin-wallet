import { satsToBtc } from '../utils';
import { BtcAmount } from './amount';

describe('BtcAmount', () => {
  describe('constructor', () => {
    it('creates a BtcAmount instance with a number', async () => {
      const val = new BtcAmount(1);
      expect(val.value).toStrictEqual(BigInt(1));
    });

    it('creates a BtcAmount instance with a bigint', async () => {
      const val = new BtcAmount(BigInt(1));
      expect(val.value).toStrictEqual(BigInt(1));
    });
  });

  describe('toString', () => {
    it('returns a satsToBtc string with unit', async () => {
      const val = new BtcAmount(1);
      expect(val.toString(true)).toBe(`${satsToBtc(val.value)} BTC`);
    });

    it('returns a satsToBtc string without unit', async () => {
      const val = new BtcAmount(1);
      expect(val.toString()).toStrictEqual(satsToBtc(val.value));
    });
  });
});
