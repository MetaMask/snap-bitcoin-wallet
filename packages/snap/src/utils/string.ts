import { remove0x, HexStruct } from '@metamask/utils';
import { Buffer } from 'buffer';
import { assert } from 'superstruct';

/**
 * Converts a hex string to a buffer instance.
 *
 * @param hexStr - The hex string to convert to a buffer.
 * @param trimPrefix - A flag indicating whether to remove the '0x' prefix from the hex string.
 * @returns The buffer instance.
 * @throws An error if the hex string cannot be converted to a buffer.
 */
export function hexToBuffer(hexStr: string, trimPrefix = true) {
  try {
    assert(hexStr, HexStruct);
    return Buffer.from(trimPrefix ? remove0x(hexStr) : hexStr, 'hex');
  } catch (error) {
    throw new Error('Unable to convert hex string to buffer');
  }
}

/**
 * Converts a buffer instance to a string.
 *
 * @param buffer - The buffer instance to convert to a string.
 * @param encoding - The encoding to use when converting the buffer to a string.
 * @returns The converted string.
 * @throws An error if the buffer cannot be converted to a string.
 */
export function bufferToString(buffer: Buffer, encoding: BufferEncoding) {
  try {
    return buffer.toString(encoding);
  } catch (error) {
    throw new Error('Unable to convert buffer to string');
  }
}

/**
 * Replaces the middle characters of a string with a given string.
 *
 * @param str - The string to replace.
 * @param headLength - The length of the head of the string that should not be replaced.
 * @param tailLength - The length of the tail of the string that should not be replaced.
 * @param replaceStr - The string to replace the middle characters with. Default is '...'.
 * @returns The formatted string.
 * @throws An error if the given headLength and tailLength cannot be replaced.
 */
export function replaceMiddleChar(
  str: string,
  headLength: number,
  tailLength: number,
  replaceStr = '...',
) {
  if (!str) {
    return str;
  }
  // Enforces indexes to be positive to avoid parameter swapping in `.substring`
  if (headLength < 0 || tailLength < 0) {
    throw new Error('Indexes must be positives');
  }
  // Check upper bound (using + is safe here, since we know that both lengths are positives)
  if (headLength + tailLength > str.length) {
    throw new Error('Indexes out of bounds');
  }
  return `${str.substring(0, headLength)}${replaceStr}${str.substring(
    str.length - tailLength,
  )}`;
}

/**
 * Format the address in shorten string.
 *
 * @param address - The address to format.
 * @returns The formatted address.
 */
export function shortenAddress(address: string) {
  return replaceMiddleChar(address, 5, 3);
}
