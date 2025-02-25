import type { CaipAssetType } from '@metamask/utils';

export type AssetRate = [CaipAssetType, number | null];

export type ExchangeRates = {
  [ticker: string]: {
    value: number;
  };
};

export type AssetPricesClient = {
  /**
   * Returns a list of exchange rates for all supported currencies.
   * @param baseCurrency - the currency to convert prices to. Defaults to 'btc'.
   */
  exchangeRates(baseCurrency?: string): Promise<ExchangeRates>;
};
