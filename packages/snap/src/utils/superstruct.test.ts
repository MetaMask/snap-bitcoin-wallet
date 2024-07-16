import { assert } from 'superstruct';

import { Config } from '../config';
import * as superstruct from './superstruct';

describe('superstruct', () => {
  describe('PositiveNumberStringStruct', () => {
    it('validates correctly', () => {
      expect(() =>
        assert('1', superstruct.PositiveNumberStringStruct),
      ).not.toThrow(Error);
      expect(() =>
        assert('1.2', superstruct.PositiveNumberStringStruct),
      ).not.toThrow(Error);
      expect(() =>
        assert('0', superstruct.PositiveNumberStringStruct),
      ).not.toThrow(Error);
      expect(() =>
        assert('0.0023', superstruct.PositiveNumberStringStruct),
      ).not.toThrow();
      expect(() =>
        assert('0101', superstruct.PositiveNumberStringStruct),
      ).toThrow(Error);
      expect(() =>
        assert('0101.1', superstruct.PositiveNumberStringStruct),
      ).toThrow(Error);
      expect(() =>
        assert('-0101', superstruct.PositiveNumberStringStruct),
      ).toThrow(Error);
      expect(() =>
        assert('-1.3', superstruct.PositiveNumberStringStruct),
      ).toThrow(Error);
      expect(() =>
        assert(' 1.3', superstruct.PositiveNumberStringStruct),
      ).toThrow(Error);
      expect(() =>
        assert('+1-3', superstruct.PositiveNumberStringStruct),
      ).toThrow(Error);
      expect(() =>
        assert('abc', superstruct.PositiveNumberStringStruct),
      ).toThrow(Error);
    });
  });

  describe('ScopeStruct', () => {
    it('validates correctly', () => {
      expect(() =>
        assert(Config.availableNetworks[0], superstruct.ScopeStruct),
      ).not.toThrow();
      expect(() => assert('custom scope', superstruct.ScopeStruct)).toThrow(
        Error,
      );
    });
  });

  describe('AssetsStruct', () => {
    it('validates correctly', () => {
      expect(() =>
        assert(Config.availableAssets[0], superstruct.AssetsStruct),
      ).not.toThrow();
      expect(() => assert('custom scope', superstruct.AssetsStruct)).toThrow(
        Error,
      );
    });
  });
});
