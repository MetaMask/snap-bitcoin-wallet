import Big from 'big.js';

import type { ScriptType } from '../constants';
import { DustLimit, maxSatoshi } from '../constants';

/**
 * Converts a satoshis to a string representing the equivalent amount of BTC.
 *
 * @param sats - The number of satoshis to convert.
 * @returns The equivalent amount of BTC as a string, fixed to 8 decimal places.
 * @throws A Error if sats is not an integer.
 */
export function satsToBtc(sats: number | bigint): string {
  if (typeof sats === 'number' && !Number.isInteger(sats)) {
    throw new Error('satsToBtc must be called on an integer number');
  }
  const bigIntSat = new Big(sats);
  return bigIntSat.div(100000000).toFixed(8);
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

/**
 * Determines if a given amount is considered dust based on the hardcoded dust limit for a given script type.
 *
 * @param amt - The amount to compare.
 * @param scriptType - The script type for which to calculate the dust limit.
 * @returns A boolean indicating whether the amount is considered dust.
 */
export function isDust(amt: bigint | number, scriptType: ScriptType): boolean {
  // TODO: Calculate dust threshold by network fee rate, rather than hardcoding it.
  if (typeof amt === 'number') {
    return amt < DustLimit[scriptType];
  }
  return amt < BigInt(DustLimit[scriptType]);
}
