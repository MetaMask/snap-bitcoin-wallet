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
  try {
    return Buffer.from(trimPrefix ? trimHexPrefix(hexStr) : hexStr, 'hex');
  } catch (error) {
    throw new Error('Unable to convert hexStr to buffer');
  }
}

/**
 * Method to convert a buffer to a string.
 *
 * @param buffer - Hex string.
 * @param encoding - Buffer encoding.
 * @returns Converted String.
 */
export function bufferToString(buffer: Buffer, encoding: BufferEncoding) {
  try {
    return buffer.toString(encoding);
  } catch (error) {
    throw new Error('Unable to convert buffer to string');
  }
}

/**
 * Method to format a string by replacing the middle characters.
 *
 * @param str - String to replace.
 * @param headLength - Length of head.
 * @param tailLength - Length of tail.
 * @param replaceStr - String to replace with. Default is '...'.
 * @returns Formatted string.
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

  return `${str.substr(0, headLength)}${replaceStr}${str.substr(-tailLength)}`;
}
