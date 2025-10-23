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

    const tickerToAssets = new Map<string, CaipAssetType[]>();
    const assetsWithoutTicker: CaipAssetType[] = [];

    for (const asset of assets) {
      const ticker = this.#assetToTicker(asset);
      if (!ticker) {
        assetsWithoutTicker.push(asset);
        continue;
      }

      const existing = tickerToAssets.get(ticker);
      if (existing) {
        existing.push(asset);
      } else {
        tickerToAssets.set(ticker, [asset]);
      }
    }

    const promises = Array.from(tickerToAssets.entries()).map(
      async ([ticker, tickerAssets]) => {
        const cacheKey = `spotPrices:${ticker}`;
        const cachedValue = await this.#cache.get(cacheKey);

        if (cachedValue !== undefined) {
          return tickerAssets.map(
            (asset) => [asset, cachedValue as SpotPrice] as AssetRate,
          );
        }

        return this.#assetRates
          .spotPrices(ticker)
          .then(async (spotPrices) => {
            await this.#cache.set(cacheKey, spotPrices, 30000);
            return tickerAssets.map(
              (asset) => [asset, spotPrices] as AssetRate,
            );
          })
          .catch((error) => {
            this.#logger.warn(
              `Failed to fetch spot price for ticker ${ticker}`,
              error,
            );
            return tickerAssets.map((asset) => [asset, null] as AssetRate);
          });
      },
    );

    const results = await Promise.all(promises);
    const ratesMap = new Map<CaipAssetType, SpotPrice | null>();

    results.flat().forEach(([asset, rate]) => {
      ratesMap.set(asset, rate);
    });

    assetsWithoutTicker.forEach((asset) => {
      ratesMap.set(asset, null);
    });

    this.#logger.debug('BTC rates fetched successfully');
    return assets.map((asset) => {
      const rate = ratesMap.get(asset);
      return [asset, rate ?? null];
    });
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

    const promises = timePeriods.map(async (timePeriod) =>
      this.#assetRates
        .historicalPrices(timePeriod, vsCurrency)
        .then((prices) => ({ timePeriod, prices }))
        .catch((error) => {
          this.#logger.warn(
            `Failed to fetch historical prices for period ${timePeriod}`,
            error,
          );
          return { timePeriod, prices: [] };
        }),
    );

    const results = await Promise.all(promises);

    this.#logger.debug('BTC historical prices fetched successfully');
    return results.reduce<HistoricalPriceIntervals>(
      (acc, { timePeriod, prices }) => {
        acc[timePeriod] = prices;
        return acc;
      },
      {},
    );
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
