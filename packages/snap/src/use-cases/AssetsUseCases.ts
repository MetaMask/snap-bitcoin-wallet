import slip44 from '@metamask/slip44';
import type { CaipAssetType } from '@metamask/utils';
import { parseCaipAssetType } from '@metamask/utils';

import type { AssetPricesClient, AssetRate } from '../entities';
import { logger } from '../infra/logger';

export class AssetsUseCases {
  readonly #assetPrices: AssetPricesClient;

  constructor(assetPrices: AssetPricesClient) {
    this.#assetPrices = assetPrices;
  }

  async getBtcRates(assets: CaipAssetType[]): Promise<AssetRate[]> {
    logger.trace('Fetching BTC rates for: %o', assets);
    const exchangeRates = await this.#assetPrices.exchangeRates();
    logger.debug('BTC rates fetched successfully');

    return assets.map((asset): AssetRate => {
      const ticker = this.#assetToTicker(asset);
      if (ticker && exchangeRates[ticker]) {
        return [asset, exchangeRates[ticker].value];
      }

      return [asset, null];
    });
  }

  #assetToTicker(asset: CaipAssetType): string | undefined {
    const parsed = parseCaipAssetType(asset);

    if (parsed.assetNamespace === 'iso4217') {
      return parsed.assetReference.toLowerCase();
    }

    if (parsed.assetNamespace === 'slip44') {
      return slip44[parsed.assetReference]?.symbol.toLowerCase();
    }

    return undefined;
  }
}
