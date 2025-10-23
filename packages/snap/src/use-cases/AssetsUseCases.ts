import slip44 from '@metamask/slip44';
import type { HistoricalPriceIntervals } from '@metamask/snaps-sdk';
import type { CaipAssetType } from '@metamask/utils';
import { parseCaipAssetType } from '@metamask/utils';

import type {
  AssetRate,
  AssetRatesClient,
  Logger,
  SpotPrice,
  TimePeriod,
} from '../entities';
import type { ICache, Serializable } from '../store/ICache';

export class AssetsUseCases {
  readonly #logger: Logger;

  readonly #assetRates: AssetRatesClient;

  readonly #cache: ICache<Serializable>;

  constructor(
    logger: Logger,
    assetRates: AssetRatesClient,
    cache: ICache<Serializable>,
  ) {
    this.#logger = logger;
    this.#assetRates = assetRates;
    this.#cache = cache;
  }

  async getRates(assets: CaipAssetType[]): Promise<AssetRate[]> {
    this.#logger.debug('Fetching BTC rates for: %o', assets);

    const assetRates: AssetRate[] = [];

    for (const asset of assets) {
      const ticker = this.#assetToTicker(asset);
      if (!ticker) {
        assetRates.push([asset, null]);
        continue;
      }

      const cacheKey = `spotPrices:${ticker}`;

      try {
        const cachedValue = await this.#cache.get(cacheKey);

        let spotPrices: SpotPrice;
        if (cachedValue === undefined) {
          spotPrices = await this.#assetRates.spotPrices(ticker);
          // use 30secs as the ttl since we don't wanna risk stale prices
          // just to avoid back to back calls for the same ticker
          await this.#cache.set(cacheKey, spotPrices, 30000);
        } else {
          spotPrices = cachedValue as SpotPrice;
        }

        assetRates.push([asset, spotPrices]);
      } catch (error) {
        this.#logger.warn(
          'Failed to fetch spot price for %s (ticker: %s). Error: %s',
          asset,
          ticker,
          error,
        );
        assetRates.push([asset, null]);
      }
    }

    this.#logger.debug('BTC rates fetched successfully');
    return assetRates;
  }

  async getPriceIntervals(
    to: CaipAssetType,
  ): Promise<HistoricalPriceIntervals> {
    this.#logger.debug('Fetching BTC historical prices. To %s', to);

    const timePeriods: TimePeriod[] = [
      'P1D',
      'P7D',
      'P1M',
      'P3M',
      'P1Y',
      'P1000Y',
    ];
    const vsCurrency = this.#assetToTicker(to);
    const historicalPrices: HistoricalPriceIntervals = {};
    await Promise.all(
      timePeriods.map(async (timePeriod) => {
        try {
          historicalPrices[timePeriod] =
            await this.#assetRates.historicalPrices(timePeriod, vsCurrency);
        } catch (error) {
          this.#logger.warn(
            'Failed to fetch historical prices for period %s. Error: %s',
            timePeriod,
            error,
          );
          historicalPrices[timePeriod] = [];
        }
      }),
    );

    this.#logger.debug('BTC historical prices fetched successfully');
    return historicalPrices;
  }

  #assetToTicker(asset: CaipAssetType): string | undefined {
    const { assetNamespace, assetReference } = parseCaipAssetType(asset);

    if (assetNamespace === 'iso4217') {
      return assetReference.toLowerCase();
    }

    if (assetNamespace === 'slip44') {
      return slip44[
        assetReference as keyof typeof slip44
      ]?.symbol.toLowerCase();
    }

    return undefined;
  }
}
