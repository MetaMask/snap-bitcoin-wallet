import type { Infer } from 'superstruct';
import { object, string, assign, array, record } from 'superstruct';

import { Chain } from '../../modules/config';
import { Factory } from '../../modules/factory';
import {
  TransactionService,
  TransactionStateManager,
} from '../../modules/transaction';
import type { StaticImplements } from '../../types/static';
import { assetsStruct, numberStringStruct } from '../../types/superstruct';
import { BaseSnapRpcHandler } from '../base';
import type { IStaticSnapRpcHandler, SnapRpcHandlerResponse } from '../types';
import { SnapRpcHandlerRequestStruct } from '../types';

export type GetBalancesParams = Infer<typeof GetBalancesHandler.requestStruct>;

export type GetBalancesResponse = SnapRpcHandlerResponse &
  Infer<typeof GetBalancesHandler.responseStruct>;

export class GetBalancesHandler
  extends BaseSnapRpcHandler
  implements StaticImplements<IStaticSnapRpcHandler, typeof GetBalancesHandler>
{
  static override get requestStruct() {
    return assign(
      object({
        accounts: array(string()),
        assets: array(assetsStruct),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  static override get responseStruct() {
    return object({
      balances: record(
        string(),
        record(
          assetsStruct,
          object({
            amount: numberStringStruct,
          }),
        ),
      ),
    });
  }

  async handleRequest(params: GetBalancesParams): Promise<GetBalancesResponse> {
    const { scope, accounts, assets } = params;

    const txService = new TransactionService(
      Factory.createTransactionMgr(Chain.Bitcoin, scope),
      new TransactionStateManager(),
    );

    const balances = await txService.getBalances(accounts, assets);

    const response = {
      balances: Object.entries(balances.balances).reduce(
        (balancesObj, [address, assetBalances]) => {
          balancesObj[address] = Object.entries(assetBalances).reduce(
            (assetBalanceObj, [asset, balance]) => {
              assetBalanceObj[asset] = {
                amount: balance.amount.toString(),
              };
              return assetBalanceObj;
            },
            {},
          );
          return balancesObj;
        },
        {},
      ),
    };

    return response;
  }
}
