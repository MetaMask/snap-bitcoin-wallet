import type { Infer } from 'superstruct';
import { object, string, assign, array, record } from 'superstruct';

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
import { assetsStruct, positiveStringStruct } from '../utils/superstruct';

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
            amount: positiveStringStruct,
          }),
        ),
      ),
    });
  }

  async handleRequest(params: GetBalancesParams): Promise<GetBalancesResponse> {
    const { scope, accounts, assets } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);

    const balances = await chainApi.getBalances(accounts, assets);

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
