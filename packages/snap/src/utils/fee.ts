import type { KeyringAccount } from '@metamask/keyring-api';
import { assert, enums } from 'superstruct';

import type { Fee } from '../bitcoin/chain';
import { FeeRate } from '../bitcoin/chain/constants';
import {
  BtcAccount,
  BtcAccountTypeToScriptType,
  DefaultTxMinFeeRateInBtcPerKvb,
  DustLimit,
} from '../bitcoin/wallet';
import { Config } from '../config';
import { FeeRateUnavailableError } from '../exceptions';

/**
 * Retrieves the fee rate from an array of `Fee` objects based on the fee type provided.
 * If no fee type is provided, the default fee rate specified in the configuration will be used.
 *
 * @param fees - The array of `Fee` objects.
 * @param feeType - The fee type to retrieve the fee rate for. Default is `Config.defaultFeeRate`
 * @returns The fee rate for the given fee type or default fee rate.
 * @throws {FeeRateUnavailableError} If no `Fee` object is found for the provided fee type.
 */
export function getFeeRate(
  fees: Fee[],
  feeType: FeeRate = Config.defaultFeeRate,
) {
  assert(feeType, enums(Object.values(FeeRate)));

  const selectedFees = fees.find((fee) => fee.type === feeType);

  if (!selectedFees) {
    throw new FeeRateUnavailableError();
  }
  // Fee rate cannot be lower than 1
  return Math.max(Number(selectedFees.rate), 1);
}

/**
 * Estimate the minimum fee rate considering required fee.
 * Reference: https://github.com/bitcoin/bitcoin/blob/v28.0/src/wallet/fees.cpp#L58-L81.
 *
 * @param smartFee - The fee rate estimated by the estimatesmartfee rpc in BTC/kvB.
 * @param mempoolminfee - Minimum fee rate in BTC/kvB for tx to be accepted.
 * @param minrelaytxfee - Current minimum relay fee in BTC/kB for transactions.
 * @returns The minimum fee rate in BTC/kvB.
 */
export function getMinimumFeeRateInKvb(
  smartFee: number,
  mempoolminfee: number,
  minrelaytxfee: number,
) {
  // Obey mempool min fee when using smart fee estimation
  const minFee = Math.max(smartFee, mempoolminfee);
  // Prevent user from paying a fee below the required fee rate - `minrelaytxfee`
  const minRequiredFee = Math.max(
    minFee,
    minrelaytxfee,
    DefaultTxMinFeeRateInBtcPerKvb,
  );

  return minRequiredFee;
}

/**
 * Retrieves the dust threshold for a given account.
 *
 * @param account - The account for which to retrieve the dust threshold.
 * @returns The dust threshold for the given account.
 */
export function getDustThreshold(account: KeyringAccount | BtcAccount): number {
  if (account instanceof BtcAccount) {
    return DustLimit[account.scriptType];
  }
  const scriptType = BtcAccountTypeToScriptType[account.type];
  return DustLimit[scriptType];
}
