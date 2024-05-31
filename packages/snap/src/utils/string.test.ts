import { Buffer } from 'buffer';

import {
  trimHexPrefix,
  hexToBuffer,
  bufferToString,
  replaceMiddleChar,
} from './string';

describe('trimHexPrefix', () => {
  it('trims hex prefix', () => {
    const key = '0x1234';
    const result = trimHexPrefix(key);

    expect(result).toBe('1234');
  });

  it('returns key as is if it does not have hex prefix', () => {
    const key = '1234';
    const result = trimHexPrefix(key);

    expect(result).toBe('1234');
  });
});

describe('hexToBuffer', () => {
  it('converts a hex string to buffer with trimed prefix', () => {
    const key = '0x1234';
    const result = hexToBuffer(key);

    expect(result).toStrictEqual(Buffer.from('1234', 'hex'));
  });

  it('converts a hex string to buffer without trimed prefix', () => {
    const key = '0x1234';
    const result = hexToBuffer(key, false);

    expect(result).toStrictEqual(Buffer.from('0x1234', 'hex'));
  });

  it('throws `Unable to convert hexStr to buffer` error if the execution fail', () => {
    expect(() => hexToBuffer(null as unknown as string)).toThrow(
      'Unable to convert hexStr to buffer',
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
});
