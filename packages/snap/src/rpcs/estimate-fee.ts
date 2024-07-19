import { object, string, type Infer, nonempty, enums } from 'superstruct';

import { TxValidationError } from '../bitcoin/wallet';
import { Config } from '../config';
import { AccountNotFoundError, FeeRateUnavailableError } from '../exceptions';
import { Factory } from '../factory';
import { KeyringStateManager } from '../stateManagement';
import {
  isSnapRpcError,
  btcToSats,
  validateRequest,
  validateResponse,
  logger,
  PositiveNumberStringStruct,
  AmountStruct,
  satsToBtc,
} from '../utils';

export const EstimateFeeParamsStruct = object({
  account: nonempty(string()),
  amount: AmountStruct,
});

export const EstimateFeeResponseStruct = object({
  fee: object({
    amount: nonempty(PositiveNumberStringStruct),
    unit: enums([Config.unit]),
  }),
});

export type EstimateFeeParams = Infer<typeof EstimateFeeParamsStruct>;

export type EstimateFeeResponse = Infer<typeof EstimateFeeResponseStruct>;

/**
 * Estimate transaction fee.
 *
 * @param params - The parameters for estimate the fee.
 * @returns A Promise that resolves to an EstimateFeeResponse object.
 */
export async function estimateFee(params: EstimateFeeParams) {
  try {
    validateRequest(params, EstimateFeeParamsStruct);

    const { account: accountId, amount } = params;

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

    // TODO: when multi address support, change this to pull first address from account
    // As Estimate fee does not require an recipitent address, so we have to use the account address
    const recipients = [
      {
        address: account.address,
        value: btcToSats(amount),
      },
    ];

    const result = await wallet.estimateFee(account, recipients, {
      utxos: metadata.data.utxos,
      fee,
    });

    const resp: EstimateFeeResponse = {
      fee: {
        amount: satsToBtc(result.fee),
        unit: Config.unit,
      },
    };

    validateResponse(resp, EstimateFeeResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to estimate fee', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    if (
      error instanceof TxValidationError ||
      error instanceof AccountNotFoundError
    ) {
      throw error;
    }

    throw new Error('Failed to estimate fee');
  }
}
