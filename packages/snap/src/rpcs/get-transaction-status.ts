import type { Infer } from 'superstruct';
import { object, string, assign, enums } from 'superstruct';

import { TransactionStatus } from '../chain';
import { Factory } from '../factory';
import {
  SnapRpcHandlerRequestStruct,
  BaseSnapRpcHandler,
} from '../modules/rpc';
import type {
  IStaticSnapRpcHandler,
  SnapRpcHandlerResponse,
} from '../modules/rpc';
import type { StaticImplements } from '../types/static';

export type GetTransactionStatusParams = Infer<
  typeof GetTransactionStatusHandler.requestStruct
>;

export type GetTransactionStatusResponse = SnapRpcHandlerResponse &
  Infer<typeof GetTransactionStatusHandler.responseStruct>;

export class GetTransactionStatusHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof GetTransactionStatusHandler>
{
  static override get requestStruct() {
    return assign(
      object({
        transactionId: string(),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  static override get responseStruct() {
    return object({
      status: enums(Object.values(TransactionStatus)),
    });
  }

  async handleRequest(
    params: GetTransactionStatusParams,
  ): Promise<GetTransactionStatusResponse> {
    const { scope, transactionId } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);

    const resp = await chainApi.getTransactionStatus(transactionId);

    return {
      status: resp.status,
    };
  }
}
