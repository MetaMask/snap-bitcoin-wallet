import { object, string, type Infer, nonempty, enums } from 'superstruct';

import { TxValidationError } from '../bitcoin/wallet';
import { Config } from '../config';
import { AccountNotFoundError } from '../exceptions';
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
  getFeeRate,
  verifyIfAccountValid,
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
 * This function will traverse account's UTXOs to verify the amount and compute the fee estimation.
 *
 * @param params - The parameters to use when estimating the fee.
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

    verifyIfAccountValid(account, walletData.account);

    const chainApi = Factory.createOnChainServiceProvider(walletData.scope);

    const feesResp = await chainApi.getFeeRates();

    const fee = getFeeRate(feesResp.fees);

    const metadata = await chainApi.getDataForTransaction(account.address);

    // TODO: change this to use the first address from account when we support multi-addresses per accounts
    // We do not need the real recipient address when estimating the fees, so we just use our account's address here
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

    // The fee estimation will be inaccurate when:
    // - The account has no input (no UTXOs)
    // - The account does not have enough funds to cover the requested amount
    // - There is no output when computing the estimation
    //
    // NOTE: It is by design that we do not raise any error for now
    if (!result.inputs || !result.outputs) {
      logger.warn(
        'No input or output found, fee estimation might be inaccurate',
      );
    }

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
