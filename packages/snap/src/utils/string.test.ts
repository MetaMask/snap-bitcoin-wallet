import { Buffer } from 'buffer';

import {
  hexToBuffer,
  bufferToString,
  replaceMiddleChar,
  shortenAddress,
} from './string';

describe('hexToBuffer', () => {
  it('converts a hex string to buffer with trimmed prefix', () => {
    const key = '0x1234';
    const result = hexToBuffer(key);

    expect(result).toStrictEqual(Buffer.from('1234', 'hex'));
  });

  it('converts a hex string to buffer without trimmed prefix', () => {
    const key = '0x1234';
    const result = hexToBuffer(key, false);

    expect(result).toStrictEqual(Buffer.from('0x1234', 'hex'));
  });

  it('throws `Unable to convert hex string to buffer` error if the execution fail', () => {
    expect(() => hexToBuffer(null as unknown as string)).toThrow(
      'Unable to convert hex string to buffer',
    );
  });

  it('throws `Unable to convert hex string to buffer` error if the given string is not a hex string', () => {
    expect(() => hexToBuffer('hello123')).toThrow(
      'Unable to convert hex string to buffer',
    );
  });
});

describe('bufferToString', () => {
  it('converts a buffer to string with encoding', () => {
    const result = bufferToString(Buffer.from('1234', 'hex'), 'hex');
    expect(result).toBe('1234');
  });

  it('throws `Unable to convert buffer to string` error if the execution fail', () => {
    expect(() => bufferToString(undefined as unknown as Buffer, 'hex')).toThrow(
      'Unable to convert buffer to string',
    );
  });
});

describe('replaceMiddleChar', () => {
  const str = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';
  it('replaces the middle of a string', () => {
    expect(replaceMiddleChar(str, 5, 3)).toBe('tb1qt...aeu');
  });

  it('does not replace if the string is empty', () => {
    expect(replaceMiddleChar('', 5, 3)).toBe('');
  });

  it('throws `Indexes must be positives` error if headLength or tailLength is negative value', () => {
    expect(() => replaceMiddleChar(str, -1, 20)).toThrow(
      'Indexes must be positives',
    );
    expect(() => replaceMiddleChar(str, 20, -10)).toThrow(
      'Indexes must be positives',
    );
  });

  it('throws `Indexes out of bounds` error if headLength + tailLength is out of bounds', () => {
    expect(() => replaceMiddleChar(str, 100, 0)).toThrow(
      'Indexes out of bounds',
    );
    expect(() => replaceMiddleChar(str, 0, 100)).toThrow(
      'Indexes out of bounds',
    );
  });
});

describe('shortenAddress', () => {
  const str = 'tb1qt2mpt38wmgw3j0hnr9mp5hsa7kxf2a3ktdxaeu';
  it('shorten an address', () => {
    expect(shortenAddress(str)).toBe('tb1qt...aeu');
  });
});
