import type { Infer } from 'superstruct';
import { object, string, assign } from 'superstruct';

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

export type BroadcastTransactionParams = Infer<
  typeof BroadcastTransactionHandler.requestStruct
>;

export type BroadcastTransactionResponse = SnapRpcHandlerResponse &
  Infer<typeof BroadcastTransactionHandler.responseStruct>;

export class BroadcastTransactionHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof BroadcastTransactionHandler>
{
  static override get requestStruct() {
    return assign(
      object({
        signedTransaction: string(),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  static override get responseStruct() {
    return object({
      transactionId: string(),
    });
  }

  async handleRequest(
    params: BroadcastTransactionParams,
  ): Promise<BroadcastTransactionResponse> {
    const { scope, signedTransaction } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);

    return await chainApi.boardcastTransaction(signedTransaction);
  }
}
