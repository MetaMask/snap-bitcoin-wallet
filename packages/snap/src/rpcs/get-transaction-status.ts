import type { Infer } from 'superstruct';
import { object, enums, nonempty } from 'superstruct';

import { TransactionStatus } from '../bitcoin/chain';
import { Factory } from '../factory';
import {
  isSnapRpcError,
  scopeStruct,
  validateRequest,
  validateResponse,
  logger,
  txIdStruct,
} from '../utils';

export const getTransactionStatusParamsRequestStruct = object({
  transactionId: nonempty(txIdStruct),
  scope: scopeStruct,
});

export const getTransactionStatusParamsResponseStruct = object({
  status: enums(Object.values(TransactionStatus)),
});

export type GetTransactionStatusParams = Infer<
  typeof getTransactionStatusParamsRequestStruct
>;

export type GetTransactionStatusResponse = Infer<
  typeof getTransactionStatusParamsResponseStruct
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
    validateRequest(params, getTransactionStatusParamsRequestStruct);

    const { scope, transactionId } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);

    const txStatusResp = await chainApi.getTransactionStatus(transactionId);

    const resp = {
      status: txStatusResp.status,
    };

    validateResponse(resp, getTransactionStatusParamsResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to get transaction status', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    throw new Error('Fail to get the transaction status');
  }
}
