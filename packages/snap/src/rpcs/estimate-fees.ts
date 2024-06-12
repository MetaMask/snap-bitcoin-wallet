import type { Infer } from 'superstruct';
import { object, array, enums } from 'superstruct';

import { FeeRatio } from '../bitcoin/chain';
import { Factory } from '../factory';
import {
  satsToBtc,
  scopeStruct,
  validateRequest,
  validateResponse,
  positiveStringStruct,
} from '../utils';

export const getFeeRateParamsStruct = object({
  scope: scopeStruct,
});

export type GetFeeRateParams = Infer<typeof getFeeRateParamsStruct>;

export const getFeeRateResponseStruct = object({
  fees: array(
    object({
      type: enums(Object.values(FeeRatio)),
      rate: positiveStringStruct,
    }),
  ),
});

export type GetFeeRateResponse = Infer<typeof getFeeRateResponseStruct>;

/**
 * Get Fee Rate per byte in BTC unit.
 *
 * @param params - The parameters for get the fee rate.
 * @returns A Promise that resolves to an GetFeeRateResponse object.
 */
export async function getFeeRates(params: GetFeeRateParams) {
  validateRequest(params, getFeeRateParamsStruct);

  const { scope } = params;

  const chainApi = Factory.createOnChainServiceProvider(scope);

  const fees = await chainApi.getFeeRates();

  const resp = {
    fees: fees.fees.map((fee) => ({
      type: fee.type,
      rate: satsToBtc(fee.rate),
    })),
  };

  validateResponse(resp, getFeeRateResponseStruct);

  return resp;
}
