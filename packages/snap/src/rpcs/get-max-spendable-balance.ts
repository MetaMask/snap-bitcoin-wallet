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
 * This function uses a binary search algorithm to compute the maximum spendable balance of the given account.
 *
 * @param params - The parameters to use when computing the max spendable balance.
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

    const {
      data: { utxos },
    } = await chainApi.getDataForTransaction([account.address]);

    let spendable = BigInt(0);
    let estimatedFee = BigInt(0);
    let low = BigInt(0);
    // Using the sum of all UTXO values as the high value, instead of directly using the balance.
    // This is more accurate because balance data may be outdated.
    let high = utxos.reduce((acc, utxo) => acc + BigInt(utxo.value), BigInt(0));

    while (low <= high) {
      // Compute the middle value.
      const mid = (low + high) / BigInt(2);

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
            utxos,
            fee,
          },
        );

        // If the middle value is valid, we can increase the low value to test a higher amount.
        if (estimateResult.outputs && estimateResult.outputs.length > 0) {
          low = mid + BigInt(1);

          if (mid > spendable) {
            // If the updated spendable amount is larger than the previous amount, then update both the spendable amount and the estimated fee.
            spendable = mid;
            estimatedFee = BigInt(estimateResult.fee);
          }
        } else {
          // If the middle value is out of bounds, we need to decrease the high value to test a lower amount.
          high = mid - BigInt(1);
        }
      } catch (error) {
        // In the case where the middle value is too small, we can increase the low value to test a higher amount. This scenario typically occurs when the sum of the account's UTXOs is too small.
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
