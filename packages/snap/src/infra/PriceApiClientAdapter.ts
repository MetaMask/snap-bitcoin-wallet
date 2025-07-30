import type { HistoricalPriceValue } from '@metamask/snaps-sdk';

import {
  ExternalServiceError,
  type AssetRatesClient,
  type PriceApiConfig,
  type SpotPrice,
  type TimePeriod,
} from '../entities';

type SpotPricesResponse = {
  price: number;
  marketCap: number;
  allTimeHigh: number;
  allTimeLow: number;
  totalVolume: number;
  circulatingSupply: number;
  pricePercentChange1h: number;
  pricePercentChange1d: number;
  pricePercentChange7d: number;
  pricePercentChange14d: number;
  pricePercentChange30d: number;
  pricePercentChange200d: number;
  pricePercentChange1y: number;
};

type HistoricalPricesResponse = {
  prices: [number, number | null][];
};

export class PriceApiClientAdapter implements AssetRatesClient {
  readonly #endpoint: string;

  constructor(config: PriceApiConfig) {
    this.#endpoint = config.url;
  }

  async spotPrices(
    vsCurrency = 'usd',
    baseCurrency = 'bitcoin',
  ): Promise<SpotPrice> {
    const url = `${
      this.#endpoint
    }/v1/spot-prices/${baseCurrency}?vsCurrency=${vsCurrency}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new ExternalServiceError(`Failed to fetch spot prices`, {
          vsCurrency,
          baseCurrency,
          response: response.statusText,
        });
      }

      const prices: SpotPricesResponse = await response.json();
      return {
        price: prices.price,
        marketData: {
          fungible: true,
          allTimeHigh: prices.allTimeHigh.toString(),
          allTimeLow: prices.allTimeLow.toString(),
          circulatingSupply: prices.circulatingSupply.toString(),
          marketCap: prices.marketCap.toString(),
          totalVolume: prices.totalVolume.toString(),
          pricePercentChange: {
            PT1H: prices.pricePercentChange1h,
            P1D: prices.pricePercentChange1d,
            P7D: prices.pricePercentChange7d,
            P14D: prices.pricePercentChange14d,
            P30D: prices.pricePercentChange30d,
            P200D: prices.pricePercentChange200d,
            P1Y: prices.pricePercentChange1y,
          },
        },
      };
    } catch (error) {
      throw new ExternalServiceError(
        `Network failure while fetching spot prices`,
        {
          vsCurrency,
          baseCurrency,
        },
        error,
      );
    }
  }

  async historicalPrices(
    timePeriod: TimePeriod,
    vsCurrency = 'usd',
    baseCurrency = 'bitcoin',
  ): Promise<HistoricalPriceValue[]> {
    const url = `${
      this.#endpoint
    }/v1/historical-prices/${baseCurrency}?timePeriod=${timePeriod.slice(
      1,
    )}&vsCurrency=${vsCurrency}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new ExternalServiceError(`Failed to fetch historical rates`, {
          timePeriod,
          vsCurrency,
          baseCurrency,
          response: response.statusText,
        });
      }

      const prices: HistoricalPricesResponse = await response.json();
      return prices.prices
        .filter(([, price]) => price !== null) // keep only non-null prices
        .map(([ts, price]) => [ts, (price as number).toString()]);
    } catch (error) {
      throw new ExternalServiceError(
        `Network failure while fetching historical prices`,
        {
          timePeriod,
          vsCurrency,
          baseCurrency,
        },
        error,
      );
    }
  }
}
