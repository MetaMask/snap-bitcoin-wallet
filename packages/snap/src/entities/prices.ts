import type { CaipAssetId } from '@metamask/utils';

export type CurrencyPriceClient = {
  getFiatExchangeRates(): Promise<Record<FiatTicker, ExchangeRate>>;
  getSpotPrices(assetIds: CaipAssetId, unit: string): Promise<SpotPrices>;
};
