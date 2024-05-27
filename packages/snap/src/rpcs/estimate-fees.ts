import type { Infer } from 'superstruct';
import { object, array, enums } from 'superstruct';

import { FeeRatio } from '../chain';
import { Factory } from '../factory';
import { satsToBtc } from '../modules/bitcoin/utils/unit';
import {
  type IStaticSnapRpcHandler,
  type SnapRpcHandlerResponse,
  SnapRpcHandlerRequestStruct,
  BaseSnapRpcHandler,
} from '../modules/rpc';
import type { StaticImplements } from '../types/static';
import { positiveStringStruct } from '../utils';

export type EstimateFeesParams = Infer<
  typeof EstimateFeesHandler.requestStruct
>;

export type EstimateFeesResponse = SnapRpcHandlerResponse &
  Infer<typeof EstimateFeesHandler.responseStruct>;

export class EstimateFeesHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof EstimateFeesHandler>
{
  static override get requestStruct() {
    return SnapRpcHandlerRequestStruct;
  }

  static override get responseStruct() {
    return object({
      fees: array(
        object({
          type: enums(Object.values(FeeRatio)),
          rate: positiveStringStruct,
        }),
      ),
    });
  }

  async handleRequest(
    params: EstimateFeesParams,
  ): Promise<EstimateFeesResponse> {
    const { scope } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);

    const fees = await chainApi.estimateFees();

    const response = {
      fees: fees.fees.map((fee) => ({
        type: fee.type,
        rate: satsToBtc(fee.rate),
      })),
    };

    return response;
  }
}
