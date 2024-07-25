import { assert, enums } from 'superstruct';

import type { Fee } from '../bitcoin/chain';
import { FeeRatio } from '../bitcoin/chain/constants';
import { Config } from '../config';
import { FeeRateUnavailableError } from '../exceptions';

/**
 * Retrieves the fee rate from an array of Fee objects based on the fee type provided.
 * If no fee type is provided, the default fee rate specified in the configuration will be used.
 *
 * @param fees - The array of Fee objects.
 * @param feeType - The fee type to retrieve the fee rate for. Default is `Config.defaultFeeRate`
 * @returns The fee rate for the given fee type or default fee rate.
 * @throws {FeeRateUnavailableError} If no fee object is found for the provided fee type.
 */
export function getFeeRate(
  fees: Fee[],
  feeType: FeeRatio = Config.defaultFeeRate,
) {
  assert(feeType, enums(Object.values(FeeRatio)));

  const selectedFees = fees.find((fee) => fee.type === feeType);

  if (!selectedFees) {
    throw new FeeRateUnavailableError();
  }
  // Fee rate cannot be lower than 1
  return Math.max(Number(selectedFees.rate), 1);
}
