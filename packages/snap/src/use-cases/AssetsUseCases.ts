import slip44 from '@metamask/slip44';
import type { CaipAssetType } from '@metamask/utils';
import { parseCaipAssetType } from '@metamask/utils';

import type { AssetRatesClient, AssetRate } from '../entities';
import { logger } from '../infra/logger';

export class AssetsUseCases {
  readonly #assetRates: AssetRatesClient;

  constructor(assetRates: AssetRatesClient) {
    this.#assetRates = assetRates;
  }

  async getRates(assets: CaipAssetType[]): Promise<AssetRate[]> {
    logger.debug('Fetching BTC rates for: %o', assets);
    const exchangeRates = await this.#assetRates.exchangeRates();
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
    const { assetNamespace, assetReference } = parseCaipAssetType(asset);

    if (assetNamespace === 'iso4217') {
      return assetReference.toLowerCase();
    }

    if (assetNamespace === 'slip44') {
      return slip44[assetReference]?.symbol.toLowerCase();
    }

    return undefined;
  }
}
