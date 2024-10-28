import type { Caip19Asset } from '../constants';
import { CurrencyRatesNotAvailableError } from '../exceptions';
import { getRatesFromMetamask } from './snap';

export const getRates = async (_asset: Caip19Asset): Promise<string> => {
  // _asset is not used because the only supported asset is 'btc' for now.
  const ratesResult = await getRatesFromMetamask('btc');

  if (!ratesResult) {
    throw new CurrencyRatesNotAvailableError();
  }
  return ratesResult.conversionRate.toString();
};
