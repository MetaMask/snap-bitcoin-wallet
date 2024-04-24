import { assert } from 'superstruct';

import { Config } from '../modules/config';
import * as superstruct from './superstruct';

describe('superstruct', () => {
  describe('numberStringStruct', () => {
    it('validates correctly', () => {
      expect(() => assert('1', superstruct.numberStringStruct)).not.toThrow(
        Error,
      );
      expect(() => assert('1.2', superstruct.numberStringStruct)).not.toThrow(
        Error,
      );
      expect(() => assert('0', superstruct.numberStringStruct)).not.toThrow(
        Error,
      );
      expect(() =>
        assert('0.0023', superstruct.numberStringStruct),
      ).not.toThrow();
      expect(() => assert('0101', superstruct.numberStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('0101.1', superstruct.numberStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('-0101', superstruct.numberStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('-1.3', superstruct.numberStringStruct)).toThrow(
        Error,
      );
      expect(() => assert(' 1.3', superstruct.numberStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('+1-3', superstruct.numberStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('abc', superstruct.numberStringStruct)).toThrow(
        Error,
      );
    });
  });

  describe('scopeStruct', () => {
    it('validates correctly', () => {
      expect(() =>
        assert(
          Config.avaliableNetworks[Config.chain][0],
          superstruct.scopeStruct,
        ),
      ).not.toThrow();
      expect(() => assert('custom scope', superstruct.scopeStruct)).toThrow(
        Error,
      );
    });
  });

  describe('assetsStruct', () => {
    it('validates correctly', () => {
      expect(() =>
        assert(
          Config.avaliableAssets[Config.chain][0],
          superstruct.assetsStruct,
        ),
      ).not.toThrow();
      expect(() => assert('custom scope', superstruct.assetsStruct)).toThrow(
        Error,
      );
    });
  });

  describe('feeRatioStruct', () => {
    it('validates correctly', () => {
      expect(() => assert('fast', superstruct.feeRatioStruct)).not.toThrow(
        Error,
      );
      expect(() => assert('very-fast', superstruct.feeRatioStruct)).toThrow(
        Error,
      );
    });
  });
});
