import type { HistoricalPriceValue } from '@metamask/snaps-sdk';

import type {
  AssetRatesClient,
  ExchangeRates,
  PriceApiConfig,
  TimePeriod,
} from '../entities';

export type HistoricalPricesResponse = {
  prices: [number, number][];
};

export class PriceApiClientAdapter implements AssetRatesClient {
  readonly #endpoint: string;

  constructor(config: PriceApiConfig) {
    this.#endpoint = config.url;
  }

  async exchangeRates(baseCurrency = 'btc'): Promise<ExchangeRates> {
    const url = `${
      this.#endpoint
    }/v1/exchange-rates?baseCurrency=${baseCurrency}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
    }

    return await response.json();
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
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch historical rates: ${response.statusText}`,
      );
    }

    const prices: HistoricalPricesResponse = await response.json();
    return prices.prices.map(([timestamp, price]) => [
      timestamp,
      price.toString(),
    ]);
  }
}
