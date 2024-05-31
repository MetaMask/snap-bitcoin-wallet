import type { Infer } from 'superstruct';
import { object, assign, array, record, enums } from 'superstruct';

import { Config } from '../config';
import { Factory } from '../factory';
import { type Wallet as WalletData } from '../keyring';
import { SnapRpcError, SnapRpcHandlerRequestStruct } from '../libs/rpc';
import type {
  IStaticSnapRpcHandler,
  SnapRpcHandlerResponse,
} from '../libs/rpc';
import type { StaticImplements } from '../types/static';
import { assetsStruct, positiveStringStruct } from '../utils/superstruct';
import type { IAmount } from '../wallet';
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
        assets: array(assetsStruct),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  static override get responseStruct() {
    const unit = Config.unit[Config.chain];
    return record(
      assetsStruct,
      object({
        amount: positiveStringStruct,
        unit: enums([unit]),
      }),
    );
  }

  constructor(walletData: WalletData) {
    super();
    this.walletData = walletData;
  }

  async handleRequest(params: GetBalancesParams): Promise<GetBalancesResponse> {
    try {
      const { scope, assets } = params;

      const chainApi = Factory.createOnChainServiceProvider(scope);
      const addresses = [this.walletAccount.address];
      const addressesSet = new Set(addresses);
      const assetsSet = new Set(assets);

      const balances = await chainApi.getBalances(addresses, assets);

      const balancesVals = Object.entries(balances.balances);
      const balancesMap = new Map<string, IAmount>();

      for (const [address, assetBalances] of balancesVals) {
        if (!addressesSet.has(address)) {
          continue;
        }
        for (const asset in assetBalances) {
          if (!assetsSet.has(asset)) {
            continue;
          }

          const { amount } = assetBalances[asset];
          const currentAmount = balancesMap.get(asset);
          if (currentAmount) {
            currentAmount.value += amount.value;
          }

          balancesMap.set(asset, currentAmount ?? amount);
        }
      }

      return Object.fromEntries(
        [...balancesMap.entries()].map(([asset, amount]) => [
          asset,
          {
            amount: amount.toString(),
            unit: amount.unit,
          },
        ]),
      );
    } catch (error) {
      throw new SnapRpcError('Fail to get the balances');
    }
  }
}
