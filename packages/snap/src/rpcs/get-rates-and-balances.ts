import type { BtcAccount } from '../bitcoin/wallet';
import type { Caip2Asset } from '../constants';
import { getRates } from '../utils/rates';
import { getBalances } from './get-balances';

export type GetRatesAndBalancesParams = {
  asset: Caip2Asset;
  scope: string;
  btcAccount: BtcAccount;
};

/**
 * Fetches rates and balances for a given asset and account.
 *
 * @param options - The options for fetching rates and balances.
 * @param options.asset - The asset to fetch rates and balances for.
 * @param options.scope - The scope for fetching rates.
 * @param options.btcAccount - The Bitcoin account to fetch balances for.
 * @returns An object containing rates and balances.
 */
export async function createRatesAndBalances({
  asset,
  scope,
  btcAccount,
}: GetRatesAndBalancesParams) {
  const errors = {
    rates: '',
    balances: '',
  };
  let rates;
  let balances;

  const [ratesResult, balancesResult] = await Promise.allSettled([
    getRates(asset),
    getBalances(btcAccount, { scope, assets: [asset] }),
  ]);

  if (ratesResult.status === 'fulfilled') {
    rates = ratesResult.value;
  } else {
    errors.rates = `Rates error: ${ratesResult.reason.message as string}`;
  }

  if (balancesResult.status === 'fulfilled') {
    balances = balancesResult.value[asset].amount;
  } else {
    errors.balances = `Balances error: ${
      balancesResult.reason.message as string
    }`;
  }

  return {
    rates: {
      value: rates,
      error: errors.rates,
    },
    balances: {
      value: balances,
      error: errors.balances,
    },
  };
}
