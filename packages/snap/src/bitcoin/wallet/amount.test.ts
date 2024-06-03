import { satsToBtc } from '../utils';
import { BtcAmount } from './amount';

describe('BtcAmount', () => {
  describe('toString', () => {
    it('returns a satsToBtc string with unit', async () => {
      const val = new BtcAmount(1);
      expect(val.toString(true)).toBe(`${satsToBtc(val.value)} BTC`);
    });

    it('returns a satsToBtc string without unit', async () => {
      const val = new BtcAmount(1);
      expect(val.toString(false)).toStrictEqual(satsToBtc(val.value));
    });
  });

  describe('valueOf', () => {
    it('returns a value', async () => {
      const val = new BtcAmount(1);
      expect(val.valueOf()).toStrictEqual(val.value);
    });
  });
});
