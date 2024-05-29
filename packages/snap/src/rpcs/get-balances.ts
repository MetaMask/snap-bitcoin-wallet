import type { Infer } from 'superstruct';
import { object, string, assign, array, record } from 'superstruct';

import { Factory } from '../factory';
import { KeyringStateManager } from '../keyring';
import { satsToBtc } from '../modules/bitcoin/utils/unit';
import { SnapRpcHandlerRequestStruct } from '../modules/rpc';
import type {
  IStaticSnapRpcHandler,
  SnapRpcHandlerResponse,
} from '../modules/rpc';
import type { StaticImplements } from '../types/static';
import { assetsStruct, positiveStringStruct } from '../utils/superstruct';
import { KeyringRpcHandler } from './keyring-rpc';

export type GetBalancesParams = Infer<typeof GetBalancesHandler.requestStruct>;

export type GetBalancesResponse = SnapRpcHandlerResponse &
  Infer<typeof GetBalancesHandler.responseStruct>;

export class GetBalancesHandler
  extends KeyringRpcHandler
  implements StaticImplements<IStaticSnapRpcHandler, typeof GetBalancesHandler>
{
  protected override isThrowValidationError = true;

  static override get requestStruct() {
    return assign(
      object({
        account: string(),
        assets: array(assetsStruct),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  static override get responseStruct() {
    return object({
      balances: record(
        assetsStruct,
        object({
          amount: positiveStringStruct,
        }),
      ),
    });
  }

  // TODO: move to keyring
  protected override async preExecute(
    params: GetBalancesParams,
  ): Promise<void> {
    const { account: accountId } = params;

    const state = new KeyringStateManager();

    const walletData = await state.getWallet(accountId);

    if (!walletData) {
      throw new Error('Account not found');
    }
    this.walletData = walletData;
    await super.preExecute(params);
  }

  async handleRequest(params: GetBalancesParams): Promise<GetBalancesResponse> {
    const { scope, assets } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);
    const addresses = [this.walletAccount.address];
    const addressesSet = new Set(addresses);
    const assetsSet = new Set(assets);

    const balances = await chainApi.getBalances(
      [this.walletAccount.address],
      assets,
    );

    const balancesVals = Object.entries(balances.balances);
    const balancesMap = new Map<string, number>();

    for (const [address, assetBalances] of balancesVals) {
      if (!addressesSet.has(address)) {
        continue;
      }
      for (const asset in assetBalances) {
        if (!assetsSet.has(asset)) {
          continue;
        }
        balancesMap.set(
          asset,
          (balancesMap.get(asset) ?? 0) + assetBalances[asset].amount,
        );
      }
    }

    return {
      balances: Object.fromEntries(
        [...balancesMap.entries()].map(([asset, amount]) => [
          asset,
          { amount: satsToBtc(amount) },
        ]),
      ),
    };
  }
}
