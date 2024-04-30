import type { Infer } from 'superstruct';
import { object, array, enums } from 'superstruct';

import { Config } from '../../config';
import { FeeRatio } from '../../modules/chain';
import { Factory } from '../../modules/factory';
import type { StaticImplements } from '../../types/static';
import { numberStringStruct } from '../../utils';
import { BaseSnapRpcHandler } from '../base';
import {
  type IStaticSnapRpcHandler,
  type SnapRpcHandlerResponse,
  SnapRpcHandlerRequestStruct,
} from '../types';

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
          rate: numberStringStruct,
        }),
      ),
    });
  }

  async handleRequest(
    params: EstimateFeesParams,
  ): Promise<EstimateFeesResponse> {
    const { scope } = params;

    const chainApi = Factory.createOnChainServiceProvider(Config.chain, scope);

    const fees = await chainApi.estimateFees();

    const response = {
      fees: fees.fees.map((fee) => ({
        type: fee.type,
        rate: fee.rate.toString(),
      })),
    };

    return response;
  }
}
