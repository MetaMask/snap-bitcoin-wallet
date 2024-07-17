import type { Infer } from 'superstruct';
import { object, enums, nonempty } from 'superstruct';

import { TransactionStatus } from '../bitcoin/chain';
import { Factory } from '../factory';
import {
  isSnapRpcError,
  ScopeStruct,
  validateRequest,
  validateResponse,
  logger,
  TxIdStruct,
} from '../utils';

export const GetTransactionStatusParamsRequestStruct = object({
  transactionId: nonempty(TxIdStruct),
  scope: ScopeStruct,
});

export const GetTransactionStatusParamsResponseStruct = object({
  status: enums(Object.values(TransactionStatus)),
});

export type GetTransactionStatusParams = Infer<
  typeof GetTransactionStatusParamsRequestStruct
>;

export type GetTransactionStatusResponse = Infer<
  typeof GetTransactionStatusParamsResponseStruct
>;

/**
 * Get Transaction Status by a given transaction id.
 *
 * @param params - The parameters for get the transaction status.
 * @returns A Promise that resolves to an GetTransactionStatusResponse object.
 */
export async function getTransactionStatus(
  params: GetTransactionStatusParams,
): Promise<GetTransactionStatusResponse> {
  try {
    validateRequest(params, GetTransactionStatusParamsRequestStruct);

    const { scope, transactionId } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);

    const txStatusResp = await chainApi.getTransactionStatus(transactionId);

    const resp = {
      status: txStatusResp.status,
    };

    validateResponse(resp, GetTransactionStatusParamsResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to get transaction status', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    throw new Error('Fail to get the transaction status');
  }
}
