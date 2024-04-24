import type { Infer } from 'superstruct';
import { object, array } from 'superstruct';

import { Config } from '../../modules/config';
import { Factory } from '../../modules/factory';
import {
  TransactionService,
  TransactionStateManager,
} from '../../modules/transaction';
import type { StaticImplements } from '../../types/static';
import { feeRatioStruct, numberStringStruct } from '../../types/superstruct';
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
          type: feeRatioStruct,
          rate: numberStringStruct,
        }),
      ),
    });
  }

  async handleRequest(
    params: EstimateFeesParams,
  ): Promise<EstimateFeesResponse> {
    const { scope } = params;

    const txService = new TransactionService(
      Factory.createTransactionMgr(Config.chain, scope),
      new TransactionStateManager(),
    );

    const fees = await txService.estimateFees();

    const response = {
      fees: fees.fees.map((fee) => ({
        type: fee.type,
        rate: fee.rate.toString(),
      })),
    };

    return response;
  }
}
