import type { CurrencyPriceClient } from '../entities';

export class AssetsUseCases {
  readonly #currencyPricesClient: CurrencyPriceClient;

  constructor(currencyPricesClient: CurrencyPriceClient) {
    this.#currencyPricesClient = currencyPricesClient;
  }

  async conversions(): Promise<
    Record<CaipAssetType, Record<CaipAssetType, AssetConversion | null>>
  > {
    const [fiatExchangeRates, cryptoPrices] = await Promise.all([
      this.#currencyPricesClient.getFiatExchangeRates(),
      this.#currencyPricesClient.getSpotPrices(cryptoAssets, 'usd'),
    ]);
  }
}
