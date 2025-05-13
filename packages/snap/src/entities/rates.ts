import type { HistoricalPriceValue } from '@metamask/snaps-sdk';
import type { CaipAssetType } from '@metamask/utils';

export type TimePeriod = 'P1D' | 'P7D' | 'P1M' | 'P3M' | 'P1Y' | 'P1000Y';
export type AssetRate = [CaipAssetType, number | null];

export type ExchangeRates = {
  [ticker: string]: {
    value: number;
  };
};

export type AssetRatesClient = {
  /**
   * Returns a list of exchange rates for all supported currencies.
   * @param baseCurrency - the currency to convert prices to. Defaults to 'btc'.
   */
  exchangeRates(baseCurrency?: string): Promise<ExchangeRates>;

  /**
   * Returns a list of historical prices for a token against another.
   * @param timePeriod - the time period to fetch prices for.
   * @param vsCurrency - the currency to convert prices to. Defaults to 'usd'.
   * @param baseCurrency - the currency to get prices for. Defaults to 'bitcoin'.
   */
  historicalPrices(
    timePeriod: TimePeriod,
    vsCurrency?: string,
    baseCurrency?: string,
  ): Promise<HistoricalPriceValue[]>;
};
