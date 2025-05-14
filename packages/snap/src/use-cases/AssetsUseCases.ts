import slip44 from '@metamask/slip44';
import type { HistoricalPriceIntervals } from '@metamask/snaps-sdk';
import type { CaipAssetType } from '@metamask/utils';
import { parseCaipAssetType } from '@metamask/utils';

import type {
  AssetRatesClient,
  AssetRate,
  Logger,
  TimePeriod,
} from '../entities';

export class AssetsUseCases {
  readonly #logger: Logger;

  readonly #assetRates: AssetRatesClient;

  constructor(logger: Logger, assetRates: AssetRatesClient) {
    this.#logger = logger;
    this.#assetRates = assetRates;
  }

  async getRates(assets: CaipAssetType[]): Promise<AssetRate[]> {
    this.#logger.debug('Fetching BTC rates for: %o', assets);
    const exchangeRates = await this.#assetRates.exchangeRates();
    this.#logger.debug('BTC rates fetched successfully');

    return assets.map((asset): AssetRate => {
      const ticker = this.#assetToTicker(asset);
      if (ticker && exchangeRates[ticker]) {
        return [asset, exchangeRates[ticker].value];
      }

      return [asset, null];
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
    const historicalPrices: HistoricalPriceIntervals = {};
    await Promise.all(
      timePeriods.map(async (timePeriod) => {
        try {
          const prices = await this.#assetRates.historicalPrices(
            timePeriod,
            vsCurrency,
          );
          historicalPrices[timePeriod] = prices;
        } catch (error) {
          this.#logger.error(
            `Failed to fetch historical prices. Time period: %s. Error: %s`,
            timePeriod,
            error,
          );
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
      return slip44[assetReference]?.symbol.toLowerCase();
    }

    return undefined;
  }
}
