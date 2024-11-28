import type { BtcAccount } from '../bitcoin/wallet';
import type { Caip19Asset } from '../constants';
import { getRates } from '../utils/rates';
import { getBalances } from './get-balances';

export type GetRatesAndBalancesParams = {
  asset: Caip19Asset;
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
    balances: '',
  };
  let rates;
  let balances;

  const [ratesResult, balancesResult] = await Promise.allSettled([
    getRates(asset),
    getBalances(btcAccount, { scope, assets: [asset] }),
  ]);

  if (ratesResult.status === 'fulfilled') {
    // Rates are "optional" here (hence the ''). If they are not available, no conversion
    // will be done.
    rates = ratesResult.value ?? '';
  }

  if (balancesResult.status === 'fulfilled') {
    balances = balancesResult.value[asset]?.amount;
    // Double-check that `getBalances` returned a valid amount for that asset.
    if (balances === undefined) {
      errors.balances = `Balances error: no balance found for "${asset}"`;
    }
  } else {
    errors.balances = `Balances error: ${
      balancesResult.reason.message as string
    }`;
  }

  return {
    rates: {
      value: rates,
    },
    balances: {
      value: balances,
      error: errors.balances,
    },
  };
}
