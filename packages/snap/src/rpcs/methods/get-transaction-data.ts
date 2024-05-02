import type { Infer } from 'superstruct';
import { unknown } from 'superstruct';

import type { StaticImplements } from '../../types/static';
import { BaseSnapRpcHandler } from '../base';
import type { IStaticSnapRpcHandler, SnapRpcHandlerResponse } from '../types';

export type GetTransactionDataParams = Infer<
  typeof GetTransactionDataHandler.requestStruct
>;

export type GetTransactionDataResponse = SnapRpcHandlerResponse &
  Infer<typeof GetTransactionDataHandler.responseStruct>;

export class GetTransactionDataHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof GetTransactionDataHandler>
{
  static override get requestStruct() {
    return unknown();
  }

  static override get responseStruct() {
    return unknown();
  }

  async handleRequest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: GetTransactionDataParams,
  ): Promise<GetTransactionDataResponse> {
    return {};
  }
}
