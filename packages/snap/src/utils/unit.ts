import BigNumber from 'bignumber.js';

import { Config } from '../config';

// Bitcoin Core's RPC 'estimatesmartfee' returns values in BTC/kvB.
// Hence, we will have to convert it back to standard BTC/vB.
// See: https://github.com/bitcoin/bitcoin/blob/v28.0/src/policy/feerate.cpp#L17
export const bitcoinCoreKB = 1000;

// Maximum amount of satoshis
export const maxSatoshi = 21 * 1e14;

// Minimum amount of satoshis
export const minSatoshi = 1;

// Rate to convert from BTC to sats
export const satsIn1Btc = 100000000;

/**
 * Converts sats/kvB to sats/vB.
 *
 * @param kvb - The amount in sats/kvB.
 * @returns The converted amount to sats/vB.
 */
export function satsKVBToVB(kvb: number | bigint): bigint {
  // It cannot be lower than 1 sat per vB.
  if (kvb < bitcoinCoreKB) {
    throw new Error(`Unable to convert kvB to vB: "${kvb}" is too small`);
  }
  // NOTE: From here, we now we can safely divides by `bitcoinCoreKB` and we know it's not
  // going to give a results of 0.

  // We still use `BigNumber` here and not `bigint` to be able to round up the result
  const bigKVB = BigNumber(kvb.toString());
  const bigKB = BigNumber(bitcoinCoreKB);
  const bigVB = bigKVB.div(bigKB).toFixed(0, BigNumber.ROUND_HALF_UP);

  return BigInt(bigVB.toString());
}

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
  const bigSat = new BigNumber(sats.toString());
  const bigBtc = bigSat.div(satsIn1Btc).toFixed(8);

  if (withUnit) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${bigBtc} ${Config.unit}`;
  }
  return bigBtc;
}

/**
 * Converts a BTC to a bigint representing the equivalent amount of satoshis.
 *
 * @param btc - The amount of BTC to convert.
 * @returns The equivalent amount of satoshis as a string, rounded to the nearest integer.
 * @throws A Error if the BTC > max amount of satoshis (21 * 1e14) or the BTC < 0 or the BTC has more than 8 decimals.
 */
export function btcToSats(btc: string): bigint {
  const bigBtc = new BigNumber(btc);
  const bigSats = bigBtc.times(satsIn1Btc);

  // If it's not a "true" integer, it means we still have some decimals, so the original
  // amount had more than 8 digits after the decimal point.
  if (!bigSats.isInteger()) {
    throw new Error('BTC amount is out of range');
  }
  if (bigSats.lt(0) || bigSats.gt(maxSatoshi)) {
    throw new Error('BTC amount is out of range');
  }
  return BigInt(bigSats.toFixed(0));
}
