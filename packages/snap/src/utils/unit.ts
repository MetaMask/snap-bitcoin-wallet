import Big from 'big.js';

import { Config } from '../config';

// Maximum amount of satoshis
export const maxSatoshi = 21 * 1e14;

// Minimum amount of satoshis
export const minSatoshi = 1;

/**
 * Converts a satoshis to a string representing the equivalent amount of BTC.
 *
 * @param sats - The number of satoshis to convert.
 * @param withUnit - A boolean indicating whether to include the unit in the string representation. Default is false.
 * @returns The equivalent amount of BTC as a string, fixed to 8 decimal places.
 * @throws A Error if sats is not an integer.
 */
export function satsToBtc(sats: number | bigint, withUnit = false): string {
  if (typeof sats === 'number' && !Number.isInteger(sats)) {
    throw new Error('satsToBtc must be called on an integer number');
  }
  const bigIntSat = new Big(sats);
  const val = bigIntSat.div(100000000).toFixed(8);

  if (withUnit) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${val} ${Config.unit}`;
  }
  return val;
}

/**
 * Converts a BTC to a bigint representing the equivalent amount of satoshis.
 *
 * @param btc - The amount of BTC to convert.
 * @returns The equivalent amount of satoshis as a string, rounded to the nearest integer.
 * @throws A Error if the BTC > max amount of satoshis (21 * 1e14) or the BTC < 0 or the BTC has more than 8 decimals.
 */
export function btcToSats(btc: string): bigint {
  const stringVals = btc.split('.');
  if (stringVals.length > 1 && stringVals[1].length > 8) {
    throw new Error('BTC amount is out of range');
  }
  const bigIntBtc = new Big(btc);
  const sats = bigIntBtc.times(100000000);
  if (sats.lt(0) || sats.gt(maxSatoshi)) {
    throw new Error('BTC amount is out of range');
  }
  return BigInt(sats.toFixed(0));
}
