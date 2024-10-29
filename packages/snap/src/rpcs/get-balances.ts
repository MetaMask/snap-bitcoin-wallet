import type { Infer } from 'superstruct';
import { object, array, record, enums } from 'superstruct';

import type { BtcAccount } from '../bitcoin/wallet';
import { Config } from '../config';
import { Factory } from '../factory';
import {
  isSnapRpcError,
  validateRequest,
  validateResponse,
  logger,
  satsToBtc,
} from '../utils';
import {
  AssetsStruct,
  PositiveNumberStringStruct,
  ScopeStruct,
} from '../utils/superstruct';

export const GetBalancesRequestStruct = object({
  assets: array(AssetsStruct),
  scope: ScopeStruct,
});

export const GetBalancesResponseStruct = record(
  AssetsStruct,
  object({
    amount: PositiveNumberStringStruct,
    unit: enums([Config.unit]),
  }),
);

export type GetBalancesParams = Infer<typeof GetBalancesRequestStruct>;

export type GetBalancesResponse = Infer<typeof GetBalancesResponseStruct>;

/**
 * Get Balances by a given account.
 *
 * @param account - The account to get the balances.
 * @param params - The parameters for get the account.
 * @returns A Promise that resolves to an GetBalancesResponse object.
 */
export async function getBalances(
  account: BtcAccount,
  params: GetBalancesParams,
) {
  try {
    validateRequest(params, GetBalancesRequestStruct);

    const { assets, scope } = params;

    const chainApi = Factory.createOnChainServiceProvider(scope);
    const addresses = [account.address];

    const balances = await chainApi.getBalances(addresses, assets);

    const resp = {};

    assets.forEach((asset) => {
      let amount = BigInt(0);
      if (Object.prototype.hasOwnProperty.call(balances.balances, asset)) {
        amount = balances.balances[asset].amount;
      }

      resp[asset] = {
        amount: satsToBtc(amount),
        unit: Config.unit,
      };
    });

    validateResponse(resp, GetBalancesResponseStruct);

    return resp;
  } catch (error) {
    logger.error('Failed to get balances', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    throw new Error('Fail to get the balances');
  }
}
