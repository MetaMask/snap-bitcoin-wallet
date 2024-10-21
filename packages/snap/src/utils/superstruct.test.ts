import { assert } from 'superstruct';

import { Config } from '../config';
import * as superstruct from './superstruct';

describe('superstruct', () => {
  describe('BitcoinAddressStruct', () => {
    it.each([
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297',
      'tb1q9lakrt5sw0w0twnc6ww4vxs7hm0q23e03286k8',
    ])('returns true for valid address: %s', (val: string) => {
      expect(() => assert(val, superstruct.BitcoinAddressStruct)).not.toThrow(
        Error,
      );
    });

    it.each(['invalid', '0xA86Df057874BB37C324210a19d3DA51aA31A74C8'])(
      'returns false for invalid address: %s',
      (val: string) => {
        expect(() => assert(val, superstruct.BitcoinAddressStruct)).toThrow(
          Error,
        );
      },
    );
  });

  describe('PositiveNumberStringStruct', () => {
    it.each(['1', '1.2', '0.0023'])(
      'does not throw error if the value is valid: %s',
      (val: string) => {
        expect(() =>
          assert(val, superstruct.PositiveNumberStringStruct),
        ).not.toThrow(Error);
      },
    );

    it.each(['0101', '0101.1', '0101', '-1.3', ' 1.3', '+1-3', 'abc', '1e89'])(
      'throws error if the value is invalid: %s',
      (val: string) => {
        expect(() =>
          assert(val, superstruct.PositiveNumberStringStruct),
        ).toThrow(Error);
      },
    );
  });

  describe('ScopeStruct', () => {
    it.each(Config.availableNetworks)(
      'does not throw error if the value is valid: %s',
      (val: string) => {
        expect(() => assert(val, superstruct.ScopeStruct)).not.toThrow(Error);
      },
    );

    it('throws error if the value is invalid', () => {
      expect(() => assert('custom scope', superstruct.ScopeStruct)).toThrow(
        Error,
      );
    });
  });

  describe('AssetsStruct', () => {
    it.each(Config.availableAssets)(
      'does not throw error if the value is valid: %s',
      (val: string) => {
        expect(() => assert(val, superstruct.AssetsStruct)).not.toThrow(Error);
      },
    );

    it('throws error if the value is invalid', () => {
      expect(() => assert('custom asset', superstruct.AssetsStruct)).toThrow(
        Error,
      );
    });
  });

  describe('TxIdStruct', () => {
    it('does not throw error if the value is valid', () => {
      expect(() =>
        assert(
          '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08',
          superstruct.TxIdStruct,
        ),
      ).not.toThrow();
    });

    it.each([
      // 63 characters long while `transactionId` is expected to be 64 long
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c0',
      // 64 characters long but with invalid characters * / z
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c*z',
      'z9a',
    ])('throws error if the value is valid: %s', (val: string) => {
      expect(() => assert(val, superstruct.TxIdStruct)).toThrow(Error);
    });
  });

  describe('AmountStruct', () => {
    it('does not throw error if the value is valid', () => {
      expect(() => assert('1', superstruct.AmountStruct)).not.toThrow();
    });

    it.each(['0', '-1', 'abc', '1e-99999999999'])(
      'throws `Invalid amount, must be a positive finite number` error if the value is invalid: %s',
      (val: string) => {
        expect(() => assert(val, superstruct.AmountStruct)).toThrow(
          'Invalid amount, must be a positive finite number',
        );
      },
    );

    it.each(['9999999999.9999999999', '9999999999.0', '0.9999999999'])(
      'throws `Invalid amount, out of bounds` error if the value is out of bounds: %s',
      (val: string) => {
        expect(() => assert(val, superstruct.AmountStruct)).toThrow(
          'Invalid amount, out of bounds',
        );
      },
    );
  });
});
