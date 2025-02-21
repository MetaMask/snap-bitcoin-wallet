import type { CaipAssetId, Json } from '@metamask/utils';
import qs from 'qs';

import type { CurrencyPriceClient, PriceApiConfig } from '../entities';

/* eslint-disable @typescript-eslint/naming-convention */
type NFTResponse = {
  next_cursor: string;
  nfts: {
    extra_metadata: {
      ordinal_details: {
        inscription_id: string;
        inscription_number: number;
        content_length: number;
        content_type: string;
        sat_number: number;
        sat_name: string;
        sat_rarity: string;
        protocol_name: string | null;
        protocol_content: Json[] | null;
        location: string;
        charms: string[] | null;
      };
      image_original_url: string | null;
    };
  }[];
};

export class PriceApiClientAdapter implements CurrencyPriceClient {
  readonly #endpoint: string;

  constructor(config: PriceApiConfig) {
    this.#endpoint = config.url;
  }

  async getFiatExchangeRates(): Promise<Record<FiatTicker, ExchangeRate>> {
    const response = await fetch(`${this.#endpoint}/v1/exchange-rates/fiat`);

    if (!response.ok) {
      throw new Error(`Failed to fetch fiat prices: ${response.statusText}`);
    }

    return await response.json();
  }

  async getSpotPrices(
    assetIds: CaipAssetId,
    unit: string = 'usd',
  ): Promise<SpotPrices> {
    const queryParams = qs.stringify(
      {
        vsCurrency: unit,
        assetIds,
        includeMarketData: false,
      },
      { arrayFormat: 'comma' },
    );

    const response = await fetch(
      `${this.#endpoint}/v3/spot-prices?${queryParams}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch cryptocurrency spot prices: ${response.statusText}`,
      );
    }

    return await response.json();
  }
}
