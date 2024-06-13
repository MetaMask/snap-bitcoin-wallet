import { assert } from 'superstruct';

import { Config } from '../config';
import * as superstruct from './superstruct';

describe('superstruct', () => {
  describe('positiveStringStruct', () => {
    it('validates correctly', () => {
      expect(() => assert('1', superstruct.positiveStringStruct)).not.toThrow(
        Error,
      );
      expect(() => assert('1.2', superstruct.positiveStringStruct)).not.toThrow(
        Error,
      );
      expect(() => assert('0', superstruct.positiveStringStruct)).not.toThrow(
        Error,
      );
      expect(() =>
        assert('0.0023', superstruct.positiveStringStruct),
      ).not.toThrow();
      expect(() => assert('0101', superstruct.positiveStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('0101.1', superstruct.positiveStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('-0101', superstruct.positiveStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('-1.3', superstruct.positiveStringStruct)).toThrow(
        Error,
      );
      expect(() => assert(' 1.3', superstruct.positiveStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('+1-3', superstruct.positiveStringStruct)).toThrow(
        Error,
      );
      expect(() => assert('abc', superstruct.positiveStringStruct)).toThrow(
        Error,
      );
    });
  });

  describe('scopeStruct', () => {
    it('validates correctly', () => {
      expect(() =>
        assert(Config.avaliableNetworks[0], superstruct.scopeStruct),
      ).not.toThrow();
      expect(() => assert('custom scope', superstruct.scopeStruct)).toThrow(
        Error,
      );
    });
  });

  describe('assetsStruct', () => {
    it('validates correctly', () => {
      expect(() =>
        assert(Config.avaliableAssets[0], superstruct.assetsStruct),
      ).not.toThrow();
      expect(() => assert('custom scope', superstruct.assetsStruct)).toThrow(
        Error,
      );
    });
  });
});
