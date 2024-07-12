import { object, string, type Infer, nonempty, enums } from 'superstruct';

import { TxValidationError } from '../bitcoin/wallet';
import { Config } from '../config';
import { AccountNotFoundError } from '../exceptions';
import { Factory } from '../factory';
import { KeyringStateManager } from '../stateManagement';
import {
  scopeStruct,
  isSnapRpcError,
  btcToSats,
  validateRequest,
  validateResponse,
  logger,
  positiveStringStruct,
  AmountStruct,
  satsToBtc,
} from '../utils';

export const EstimateFeeParamsStruct = object({
  account: nonempty(string()),
  amount: AmountStruct,
  scope: scopeStruct,
});

export const EstimateFeeResponseStruct = object({
  fee: object({
    amount: nonempty(positiveStringStruct),
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

    const { scope, account: accountId, amount } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);

    const wallet = Factory.createWallet(scope);
    const stateManager = new KeyringStateManager();
    const walletData = await stateManager.getWallet(accountId);

    if (!walletData) {
      throw new AccountNotFoundError();
    }

    const account = await wallet.unlock(
      walletData.index,
      walletData.account.type,
    );

    if (!account || account.address !== walletData.account.address) {
      throw new AccountNotFoundError();
    }

    const feesResp = await chainApi.getFeeRates();

    if (feesResp.fees.length === 0) {
      throw new Error('No fee rates available');
    }

    const fee = Math.max(
      Number(feesResp.fees[feesResp.fees.length - 1].rate),
      1,
    );

    // TODO: when multi address support, change this to pull first address from account
    // Estimate fee doesnt require an recipitent address, so we can just use the account address
    const recipients = [
      {
        address: account.address,
        value: btcToSats(amount),
      },
    ];
    const metadata = await chainApi.getDataForTransaction(account.address);

    const feeAmount = await wallet.estimateFee(account, recipients, {
      utxos: metadata.data.utxos,
      fee,
    });

    const resp: EstimateFeeResponse = {
      fee: {
        amount: satsToBtc(feeAmount),
        unit: Config.unit,
      },
    };

    validateResponse(resp, EstimateFeeResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to estimate the fee', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    if (error instanceof TxValidationError) {
      throw error;
    }

    throw new Error('Failed to estimate the fee');
  }
}
