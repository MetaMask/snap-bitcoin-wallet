import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import {
  object,
  string,
  type Infer,
  record,
  array,
  boolean,
  refine,
  optional,
  nonempty,
  assert,
} from 'superstruct';

import { type BtcAccount, TxValidationError } from '../bitcoin/wallet';
import { Factory } from '../factory';
import {
  ScopeStruct,
  isSnapRpcError,
  btcToSats,
  validateRequest,
  validateResponse,
  logger,
  AmountStruct,
  getFeeRate,
} from '../utils';

export const TransactionAmountStruct = refine(
  record(BtcP2wpkhAddressStruct, string()),
  'TransactionAmountStruct',
  (value: Record<string, string>) => {
    if (Object.entries(value).length === 0) {
      return 'Transaction must have at least one recipient';
    }

    for (const val of Object.values(value)) {
      assert(val, AmountStruct);
    }

    return true;
  },
);

export const SendManyStruct = object({
  amounts: TransactionAmountStruct,
  comment: string(),
  subtractFeeFrom: array(BtcP2wpkhAddressStruct),
  replaceable: boolean(),
  dryrun: optional(boolean()),
});

export const SendManyParamsStruct = object({
  ...SendManyStruct.schema,
  scope: ScopeStruct,
});

export const SendManyResponseStruct = object({
  txId: nonempty(string()),
  signedTransaction: optional(string()),
});

export type SendManyParams = Infer<typeof SendManyParamsStruct>;

export type SendManyResponse = Infer<typeof SendManyResponseStruct>;

export const defaultSendManyParams = (
  scope: Infer<typeof ScopeStruct>,
): SendManyParams => ({
  amounts: {},
  comment: '',
  subtractFeeFrom: [],
  replaceable: true,
  dryrun: false,
  scope,
});

/**
 * Send BTC to multiple account.
 *
 * @param account - The account to send the transaction.
 * @param _origin - The origin of the request.
 * @param params - The parameters for send the transaction.
 * @returns A Promise that resolves to an SendManyResponse object.
 */
export async function sendMany(
  account: BtcAccount,
  _origin: string,
  params: SendManyParams,
) {
  try {
    validateRequest(params, SendManyParamsStruct);

    const { dryrun, scope, subtractFeeFrom, replaceable } = params;
    const chainApi = Factory.createOnChainServiceProvider(scope);
    const wallet = Factory.createWallet(scope);

    const feesResp = await chainApi.getFeeRates();

    const fee = getFeeRate(feesResp.fees);

    const recipients = Object.entries(params.amounts).map(
      ([address, value]) => ({
        address,
        value: btcToSats(value),
      }),
    );

    const {
      data: { utxos },
    } = await chainApi.getDataForTransaction(account.address);

    const txResp = await wallet.createTransaction(account, recipients, {
      utxos,
      fee,
      subtractFeeFrom,
      replaceable,
    });

    const signedTransaction = await wallet.signTransaction(
      account.signer,
      txResp.tx,
    );

    if (dryrun) {
      const result = {
        txId: '',
        signedTransaction,
      };
      return result;
    }

    const result = await chainApi.broadcastTransaction(signedTransaction);

    const resp = {
      txId: result.transactionId,
    };

    logger.debug(`Submitted transaction ID: ${resp.txId}`);

    validateResponse(resp, SendManyResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to send the transaction', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    if (error instanceof TxValidationError) {
      throw error;
    }

    throw new Error('Failed to send the transaction');
  }
}
