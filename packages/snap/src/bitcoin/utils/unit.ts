import Big from 'big.js';

import type { ScriptType } from '../constants';
import { DustLimit } from '../constants';

/**
 * Converts a number of satoshis to a string representing the equivalent amount of BTC.
 *
 * @param sats - The number of satoshis to convert.
 * @returns The equivalent amount of BTC as a string, fixed to 8 decimal places.
 * @throws A TypeError if sats is not an integer.
 */
export function satsToBtc(sats: number): string {
  if (!Number.isInteger(sats)) {
    throw new TypeError('satsToBtc must be called on an integer number');
  }
  const bigIntSat = new Big(sats);
  return bigIntSat.div(100000000).toFixed(8);
}

/**
 * Converts a number of BTC to a string representing the equivalent amount of satoshis.
 *
 * @param btc - The amount of BTC to convert.
 * @returns The equivalent amount of satoshis as a string, rounded to the nearest integer.
 */
export function btcToSats(btc: number): string {
  const bigIntBtc = new Big(btc);
  return bigIntBtc.times(100000000).toString();
}

/**
 * Determines if a given amount is considered dust based on the hardcoded dust limit for a given script type.
 *
 * @param amt - The amount to compare.
 * @param scriptType - The script type for which to calculate the dust limit.
 * @returns A boolean indicating whether the amount is considered dust.
 */
export function isDust(amt: number, scriptType: ScriptType): boolean {
  // TODO: Calculate dust threshold by network fee rate, rather than hardcoding it.
  return amt < DustLimit[scriptType];
}
