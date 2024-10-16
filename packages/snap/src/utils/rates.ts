import type { Caip2Asset } from '../constants';
import { CurrencyRatesNotAvailableError } from '../exceptions';
import { getRatesFromMetamask } from './snap';

export const getRates = async (asset: Caip2Asset): Promise<string> => {
  const ratesResult = await getRatesFromMetamask(asset);

  if (!ratesResult) {
    throw new CurrencyRatesNotAvailableError();
  }
  return ratesResult.conversionRate.toString();
};
