import type {
  HistoricalPriceValue,
  FungibleAssetMarketData,
} from '@metamask/snaps-sdk';
import type { CaipAssetType } from '@metamask/utils';

export type TimePeriod = 'P1D' | 'P7D' | 'P1M' | 'P3M' | 'P1Y' | 'P1000Y';

export type AssetRate = [CaipAssetType, SpotPrice | null];

export type SpotPrice = {
  price: number;
  marketData: FungibleAssetMarketData;
};

export type AssetRatesClient = {
  /**
   * Returns the spot price of an asset relative to an other including market data.
   *
   * @param vsCurrency - the currency to convert prices to. Defaults to 'usd'.
   * @param baseCurrency - the currency to get prices for. Defaults to 'bitcoin'.
   */
  spotPrices(vsCurrency?: string, baseCurrency?: string): Promise<SpotPrice>;

  /**
   * Returns a list of historical prices for a token against another.
   *
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
