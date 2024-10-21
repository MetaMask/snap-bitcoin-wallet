import {
  object,
  string,
  type Infer,
  record,
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
  BitcoinAddressStruct,
} from '../utils';

export const RecipientsStruct = refine(
  record(BitcoinAddressStruct, string()),
  'RecipientsStruct',
  (value: Record<string, string>) => {
    if (Object.entries(value).length === 0) {
      return 'Recipients object must have at least one recipient';
    }

    for (const val of Object.values(value)) {
      assert(val, AmountStruct);
    }

    return true;
  },
);

export const SendBitcoinStruct = object({
  recipients: RecipientsStruct,
  replaceable: boolean(),
  dryrun: optional(boolean()),
});

export const SendBitcoinParamsStruct = object({
  ...SendBitcoinStruct.schema,
  scope: ScopeStruct,
});

export const SendBitcoinResponseStruct = object({
  txId: nonempty(string()),
  signedTransaction: optional(string()),
});

export type SendBitcoinParams = Infer<typeof SendBitcoinParamsStruct>;

export type SendBitcoinResponse = Infer<typeof SendBitcoinResponseStruct>;

/**
 * Send BTC to multiple account.
 *
 * @param account - The account to send the transaction.
 * @param _origin - The origin of the request.
 * @param params - The parameters for send the transaction.
 * @returns A Promise that resolves to an SendBitcoinResponse object.
 */
export async function sendBitcoin(
  account: BtcAccount,
  _origin: string,
  params: SendBitcoinParams,
) {
  try {
    validateRequest(params, SendBitcoinParamsStruct);

    const { dryrun, scope, replaceable } = params;
    const chainApi = Factory.createOnChainServiceProvider(scope);
    const wallet = Factory.createWallet(scope);

    const feesResp = await chainApi.getFeeRates();

    const fee = getFeeRate(feesResp.fees);

    const recipients = Object.entries(params.recipients).map(
      ([address, value]) => ({
        address,
        value: btcToSats(value),
      }),
    );

    const {
      data: { utxos },
    } = await chainApi.getDataForTransaction([account.address]);

    const txResp = await wallet.createTransaction(account, recipients, {
      utxos,
      fee,
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

    validateResponse(resp, SendBitcoinResponseStruct);

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
