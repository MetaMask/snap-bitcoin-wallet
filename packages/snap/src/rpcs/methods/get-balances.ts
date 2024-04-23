import type { Infer } from 'superstruct';
import { object, string, assign, array, enums } from 'superstruct';

import { BtcAsset } from '../../modules/bitcoin/config';
import { Chain } from '../../modules/config';
import { Factory } from '../../modules/factory';
import type { AssetBalances } from '../../modules/transaction';
import {
  TransactionService,
  TransactionStateManager,
} from '../../modules/transaction';
import type { StaticImplements } from '../../types/static';
import { BaseSnapRpcHandler } from '../base';
import type { IStaticSnapRpcHandler, SnapRpcHandlerResponse } from '../types';
import { SnapRpcHandlerRequestStruct } from '../types';

export type GetBalancesParams = Infer<typeof GetBalancesHandler.requestStruct>;

export type GetBalancesResponse = SnapRpcHandlerResponse & AssetBalances;

export class GetBalancesHandler
  extends BaseSnapRpcHandler
  implements StaticImplements<IStaticSnapRpcHandler, typeof GetBalancesHandler>
{
  static override get requestStruct() {
    return assign(
      object({
        accounts: array(string()),
        assets: array(enums(Object.values(BtcAsset))),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  requestStruct = GetBalancesHandler.requestStruct;

  async handleRequest(params: GetBalancesParams): Promise<GetBalancesResponse> {
    const { scope, accounts, assets } = params;

    const txService = new TransactionService(
      Factory.createTransactionMgr(Chain.Bitcoin, scope),
      new TransactionStateManager(),
    );

    return await txService.getBalances(accounts, assets);
  }
}
