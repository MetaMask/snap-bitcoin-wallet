import type { Infer } from 'superstruct';
import { object, string, assign } from 'superstruct';

import { Chain } from '../../modules/config';
import { Factory } from '../../modules/factory';
import type { Balance } from '../../modules/transaction';
import {
  TransactionService,
  TransactionStateManager,
} from '../../modules/transaction';
import type { StaticImplements } from '../../types/static';
import { BaseSnapRpcRequestHandler } from '../base';
import type {
  IStaticSnapRpcRequestHandler,
  SnapRpcRequestHandlerResponse,
} from '../types';
import { SnapRpcRequestHandlerRequestStruct } from '../types';

export type GetBalanceParams = Infer<typeof GetBalanceHandler.validateStruct>;

export type GetBalanceResponse = SnapRpcRequestHandlerResponse & Balance;

export class GetBalanceHandler
  extends BaseSnapRpcRequestHandler
  implements
    StaticImplements<IStaticSnapRpcRequestHandler, typeof GetBalanceHandler>
{
  static get validateStruct() {
    return assign(
      object({
        address: string(),
      }),
      SnapRpcRequestHandlerRequestStruct,
    );
  }

  validateStruct = GetBalanceHandler.validateStruct;

  async handleRequest(params: GetBalanceParams): Promise<GetBalanceResponse> {
    const { scope, address } = params;

    const txService = new TransactionService(
      Factory.createTransactionMgr(Chain.Bitcoin, scope),
      new TransactionStateManager(),
    );

    return await txService.getBalance(address);
  }
}
