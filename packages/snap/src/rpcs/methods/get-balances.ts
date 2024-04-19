import type { Infer } from 'superstruct';
import { object, string, assign, array } from 'superstruct';

import { Chain } from '../../modules/config';
import { Factory } from '../../modules/factory';
import type { AssetBalances } from '../../modules/transaction';
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

export type GetBalancesParams = Infer<typeof GetBalancesHandler.validateStruct>;

export type GetBalancesResponse = SnapRpcRequestHandlerResponse & AssetBalances;

export class GetBalancesHandler
  extends BaseSnapRpcRequestHandler
  implements
    StaticImplements<IStaticSnapRpcRequestHandler, typeof GetBalancesHandler>
{
  static get validateStruct() {
    return assign(
      object({
        accounts: array(string()),
        assets: array(string()),
      }),
      SnapRpcRequestHandlerRequestStruct,
    );
  }

  validateStruct = GetBalancesHandler.validateStruct;

  async handleRequest(params: GetBalancesParams): Promise<GetBalancesResponse> {
    const { scope, accounts, assets } = params;

    const txService = new TransactionService(
      Factory.createTransactionMgr(Chain.Bitcoin, scope),
      new TransactionStateManager(),
    );

    return await txService.getBalances(accounts, assets);
  }
}
