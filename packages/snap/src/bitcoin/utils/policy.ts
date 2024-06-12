import type { ScriptType } from '../constants';
import { DustLimit } from '../constants';

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
