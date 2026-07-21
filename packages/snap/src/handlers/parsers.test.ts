import { FormatError } from '../entities';
import { parseDerivationPath } from './parsers';

jest.mock('@metamask/bitcoindevkit', () => ({
  Psbt: { from_string: jest.fn() },
}));

describe('parseDerivationPath', () => {
  describe('valid paths', () => {
    it.each([
      {
        path: "m/84'/0'/0'",
        expected: { index: 0, network: 'bitcoin' },
      },
      {
        path: "m/84'/0'/5'",
        expected: { index: 5, network: 'bitcoin' },
      },
      {
        path: "m/84'/1'/0'",
        expected: { index: 0, network: 'regtest' },
      },
      {
        path: "m/84'/1'/99'",
        expected: { index: 99, network: 'regtest' },
      },
    ])('parses $path correctly', ({ path, expected }) => {
      expect(parseDerivationPath(path)).toStrictEqual(expected);
    });
  });

  describe('invalid paths', () => {
    it('throws for a path with fewer than 4 segments', () => {
      expect(() => parseDerivationPath("m/84'/0'")).toThrow(FormatError);
    });

    it('throws for a non-BIP-84 purpose', () => {
      expect(() => parseDerivationPath("m/44'/0'/0'")).toThrow(FormatError);
    });

    it('throws for an unsupported coin type', () => {
      expect(() => parseDerivationPath("m/84'/60'/0'")).toThrow(FormatError);
    });

    it('throws for a non-numeric account index', () => {
      expect(() => parseDerivationPath("m/84'/0'/abc'")).toThrow(FormatError);
    });

    it('throws for a negative account index', () => {
      expect(() => parseDerivationPath("m/84'/0'/-1'")).toThrow(FormatError);
    });
  });
});
