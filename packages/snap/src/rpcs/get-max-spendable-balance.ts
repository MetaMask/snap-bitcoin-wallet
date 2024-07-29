import { object, string, type Infer, nonempty, enums } from 'superstruct';

import { TransactionDustError, TxValidationError } from '../bitcoin/wallet';
import { Config } from '../config';
import { AccountNotFoundError } from '../exceptions';
import { Factory } from '../factory';
import { KeyringStateManager } from '../stateManagement';
import {
  isSnapRpcError,
  validateRequest,
  validateResponse,
  logger,
  PositiveNumberStringStruct,
  satsToBtc,
  verifyIfAccountValid,
  getFeeRate,
} from '../utils';

export const GetMaxSpendableBalanceParamsStruct = object({
  account: nonempty(string()),
});

export const GetMaxSpendableBalanceResponseStruct = object({
  fee: object({
    amount: nonempty(PositiveNumberStringStruct),
    unit: enums([Config.unit]),
  }),
  balance: object({
    amount: nonempty(PositiveNumberStringStruct),
    unit: enums([Config.unit]),
  }),
});

export type GetMaxSpendableBalanceParams = Infer<
  typeof GetMaxSpendableBalanceParamsStruct
>;

export type GetMaxSpendableBalanceResponse = Infer<
  typeof GetMaxSpendableBalanceResponseStruct
>;

/**
 * Get max spendable balance.
 *
 * This function will use the binary search algorithm to measure the max spendable balance of the account.
 *
 * @param params - The parameters to use when estimating the max spendable balance.
 * @returns A Promise that resolves to an GetMaxSpendableBalanceResponse object.
 */
export async function getMaxSpendableBalance(
  params: GetMaxSpendableBalanceParams,
) {
  try {
    validateRequest(params, GetMaxSpendableBalanceParamsStruct);

    const { account: accountId } = params;

    const stateManager = new KeyringStateManager();
    const walletData = await stateManager.getWallet(accountId);

    if (!walletData) {
      throw new AccountNotFoundError();
    }

    const wallet = Factory.createWallet(walletData.scope);

    const account = await wallet.unlock(
      walletData.index,
      walletData.account.type,
    );

    verifyIfAccountValid(account, walletData.account);

    const chainApi = Factory.createOnChainServiceProvider(walletData.scope);

    const feesResp = await chainApi.getFeeRates();

    const fee = getFeeRate(feesResp.fees);

    const metadata = await chainApi.getDataForTransaction(account.address);

    let spendable = BigInt(0);
    let estimatedFee = BigInt(0);
    let low = BigInt(0);
    // Using the sum of all UTXOs value as the high value rather than directly using the balance is more accurate due to balance data may delay.
    let high = metadata.data.utxos.reduce(
      (acc, utxo) => acc + BigInt(utxo.value),
      BigInt(0),
    );

    while (low <= high) {
      // Calculate the Math.floor in big int.
      const divisor = BigInt(2);
      const sum = low + high;
      const remainder = sum % divisor;
      const mid = (sum - remainder) / divisor;

      // Test the middle value.
      try {
        const estimateResult = await wallet.estimateFee(
          account,
          [
            {
              address: account.address,
              value: mid,
            },
          ],
          {
            utxos: metadata.data.utxos,
            fee,
          },
        );

        // If the middle value is valid, then we can increase the low value to test the higher amount.
        if (estimateResult.outputs && estimateResult.outputs.length > 0) {
          low = mid + BigInt(1);

          if (mid > spendable) {
            // Update the spendable amount if it is larger than the previous one, as well as the estimated fee.
            spendable = mid;
            estimatedFee = BigInt(estimateResult.fee);
          }
        } else {
          // If the middle value is out of bound, then we need to decrease the high value to test the lower amount.
          high = mid - BigInt(1);
        }
      } catch (error) {
        // Edge case, whem the middle value is too small, then we can increase the low value to test the higher amount, it usually happen when the sum of account's utxo is too small.
        if (error instanceof TransactionDustError) {
          low = mid + BigInt(1);
        } else {
          throw error;
        }
      }
    }

    const resp: GetMaxSpendableBalanceResponse = {
      fee: {
        amount: satsToBtc(estimatedFee),
        unit: Config.unit,
      },
      balance: {
        amount: satsToBtc(spendable),
        unit: Config.unit,
      },
    };

    validateResponse(resp, GetMaxSpendableBalanceResponseStruct);
    return resp;
  } catch (error) {
    logger.error('Failed to get max spendable balance', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    if (
      error instanceof TxValidationError ||
      error instanceof AccountNotFoundError
    ) {
      throw error;
    }

    throw new Error('Failed to get max spendable balance');
  }
}
