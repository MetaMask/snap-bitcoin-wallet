import { object, string, type Infer, nonempty, enums } from 'superstruct';

import { TransactionDustError, TxValidationError } from '../bitcoin/wallet';
import { Config } from '../config';
import { AccountNotFoundError, FeeRateUnavailableError } from '../exceptions';
import { Factory } from '../factory';
import { KeyringStateManager } from '../stateManagement';
import {
  isSnapRpcError,
  validateRequest,
  validateResponse,
  logger,
  PositiveNumberStringStruct,
  satsToBtc,
} from '../utils';

export const GetMaxSpendableBalanceParamsStruct = object({
  account: nonempty(string()),
});

export const GetMaxSpendableBalanceResponseStruct = object({
  fee: object({
    amount: nonempty(PositiveNumberStringStruct),
    unit: enums([Config.unit]),
  }),
  spendable: object({
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
 * @param params - The parameters for get max spendable balance.
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

    if (!account || account.address !== walletData.account.address) {
      throw new AccountNotFoundError();
    }

    const chainApi = Factory.createOnChainServiceProvider(walletData.scope);

    const feesResp = await chainApi.getFeeRates();

    if (feesResp.fees.length === 0) {
      throw new FeeRateUnavailableError();
    }

    const fee = Math.max(
      Number(feesResp.fees[feesResp.fees.length - 1].rate),
      1,
    );

    const metadata = await chainApi.getDataForTransaction(account.address);

    let spendable = 0;
    let estimatedFee = 0;
    let low = 0;
    let high = metadata.data.utxos.reduce((acc, utxo) => acc + utxo.value, 0);

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      try {
        const estimateResult = await wallet.estimateFee(
          account,
          [
            {
              address: account.address,
              value: BigInt(mid),
            },
          ],
          {
            utxos: metadata.data.utxos,
            fee,
          },
        );

        if (estimateResult.outputs && estimateResult.outputs.length > 0) {
          low = mid + 1;

          if (mid > spendable) {
            spendable = mid;
            // same transaction amount will always result the same fee
            estimatedFee = estimateResult.fee;
          }
        } else {
          high = mid - 1;
        }
      } catch (error) {
        if (error instanceof TransactionDustError) {
          low = mid + 1;
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
      spendable: {
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
