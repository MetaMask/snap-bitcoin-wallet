import type { ScriptType } from '../constants';
import { DustLimit } from '../constants';

/**
 * A Method to convert BTC to Satoshis.
 *
 * @param sats - Satoshis.
 * @returns Btc unit in string fixed to 8 decimal places.
 */
export function satsToBtc(sats: number): string {
  if (!Number.isInteger(sats)) {
    throw new TypeError('satsToBtc must be called on a interger number');
  }
  return (sats / 1e8).toFixed(8);
}

/**
 * A Method to convert Satoshis to Btcs.
 *
 * @param btc - Btc.
 * @returns Btc unit in string fixed to 8 decimal places.
 */
export function btcToSats(btc: number): string {
  return (btc * 1e8).toFixed(0);
}

/**
 * A Method to determine the given amount is dust base on script type.
 *
 * @param amt - Compare amount.
 * @param scriptType - Script type.
 * @returns Boolean result.
 */
export function isDust(amt: number, scriptType: ScriptType): boolean {
  return amt <= DustLimit[scriptType];
}
