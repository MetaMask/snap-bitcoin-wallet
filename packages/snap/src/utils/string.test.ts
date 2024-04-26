import { Buffer } from 'buffer';

import { trimHexPrefix, hexToBuffer } from './string';

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
  it('conver a hex string to buffer with trimed prefix', () => {
    const key = '0x1234';
    const result = hexToBuffer(key);

    expect(result).toStrictEqual(Buffer.from('1234', 'hex'));
  });

  it('conver a hex string to buffer without trimed prefix', () => {
    const key = '0x1234';
    const result = hexToBuffer(key, false);

    expect(result).toStrictEqual(Buffer.from('0x1234', 'hex'));
  });
});
