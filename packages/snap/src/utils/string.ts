import { Buffer } from 'buffer';
/**
 * Method to trim the hex prefix from an hex string.
 *
 * @param hexStr - Hex string.
 * @returns Hex string without the prefix.
 */
export function trimHexPrefix(hexStr: string) {
  return hexStr.startsWith('0x') ? hexStr.substring(2) : hexStr;
}

/**
 * Method to convert a hex string to a buffer.
 *
 * @param hexStr - Hex string.
 * @param trimPrefix - Flag to trim the hex prefix.
 * @returns Buffer instance.
 */
export function hexToBuffer(hexStr: string, trimPrefix = true) {
  return Buffer.from(trimPrefix ? trimHexPrefix(hexStr) : hexStr, 'hex');
}
