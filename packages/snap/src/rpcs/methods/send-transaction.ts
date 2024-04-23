import type { Infer } from 'superstruct';
import { unknown } from 'superstruct';

import type { AssetBalances } from '../../modules/transaction';
import type { StaticImplements } from '../../types/static';
import { BaseSnapRpcHandler } from '../base';
import type { IStaticSnapRpcHandler, SnapRpcHandlerResponse } from '../types';

export type SendTransactionParams = Infer<
  typeof SendTransactionHandler.requestStruct
>;

export type SendTransactionResponse = SnapRpcHandlerResponse & AssetBalances;

export class SendTransactionHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof SendTransactionHandler>
{
  static override get requestStruct() {
    return unknown();
  }

  async handleRequest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: SendTransactionParams,
  ): Promise<SendTransactionResponse> {
    throw new Error('Method not supported');
  }
}
