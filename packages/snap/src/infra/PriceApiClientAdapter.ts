import type {
  AssetRatesClient,
  ExchangeRates,
  PriceApiConfig,
} from '../entities';

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
}
