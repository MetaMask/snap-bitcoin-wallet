import type { Network } from '@metamask/bitcoindevkit';
import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';
import type {
  CaipAssetType,
  FungibleAssetMetadata,
  OnAssetHistoricalPriceResponse,
  OnAssetsConversionArguments,
  OnAssetsConversionResponse,
  OnAssetsLookupResponse,
  OnAssetsMarketDataArguments,
  OnAssetsMarketDataResponse,
} from '@metamask/snaps-sdk';
import { CaipAssetTypeStruct } from '@metamask/utils';
import { assert } from 'superstruct';

import type { Logger } from '../entities';
import type { AssetsUseCases } from '../use-cases';
import { Caip19Asset } from './caip';
import { networkToIcon } from './icons';

export class AssetsHandler {
  readonly #assetsUseCases: AssetsUseCases;

  readonly #expirationInterval: number;

  readonly #logger: Logger;

  constructor(
    assets: AssetsUseCases,
    expirationInterval: number,
    logger: Logger,
  ) {
    this.#assetsUseCases = assets;
    this.#expirationInterval = expirationInterval;
    this.#logger = logger;
  }

  async lookup(): Promise<OnAssetsLookupResponse> {
    // Static function that cannot fail so no need to use handle()

    const metadata = (
      network: Network,
      name: string,
      mainSymbol: string,
    ): FungibleAssetMetadata => {
      return {
        fungible: true,
        name,
        units: [
          {
            name: 'Bitcoin',
            decimals: 8,
            symbol: mainSymbol,
          },
          {
            name: 'CentiBitcoin',
            decimals: 6,
            symbol: 'cBTC',
          },
          {
            name: 'MilliBitcoin',
            decimals: 5,
            symbol: 'mBTC',
          },
          {
            name: 'Bit',
            decimals: 2,
            symbol: 'bits',
          },
          {
            name: 'Satoshi',
            decimals: 0,
            symbol: 'satoshi',
          },
        ],
        iconUrl: networkToIcon[network],
        symbol: mainSymbol,
      };
    };

    // Use the same denominations as Bitcoin for testnets but change the name and main unit symbol
    return {
      assets: {
        [Caip19Asset.Bitcoin]: metadata('bitcoin', 'Bitcoin', 'BTC'),
        [Caip19Asset.Testnet]: metadata('testnet', 'Testnet Bitcoin', 'tBTC'),
        [Caip19Asset.Testnet4]: metadata(
          'testnet4',
          'Testnet4 Bitcoin',
          'tBTC',
        ),
        [Caip19Asset.Signet]: metadata('signet', 'Signet Bitcoin', 'sBTC'),
        [Caip19Asset.Regtest]: metadata('regtest', 'Regtest Bitcoin', 'rBTC'),
      },
    };
  }

  async conversion(
    conversions: OnAssetsConversionArguments['conversions'],
  ): Promise<OnAssetsConversionResponse> {
    const conversionTime = getCurrentUnixTimestamp();

    // Group conversions by "from"
    const assetMap: Record<CaipAssetType, CaipAssetType[]> = {};
    for (const { from, to } of conversions) {
      assetMap[from] ??= [];
      assetMap[from].push(to);
    }

    const conversionRates: OnAssetsConversionResponse['conversionRates'] = {};

    for (const [fromAsset, toAssets] of Object.entries(assetMap)) {
      const fromKey = fromAsset as keyof typeof conversionRates;
      conversionRates[fromKey] = {};

      if (fromKey === (Caip19Asset.Bitcoin as CaipAssetType)) {
        // For Bitcoin, fetch rates.
        for (const [toAsset, rate] of await this.#assetsUseCases.getRates(
          toAssets,
        )) {
          conversionRates[fromKey][toAsset] = rate
            ? {
                rate: rate.price.toString(),
                conversionTime,
                expirationTime: conversionTime + this.#expirationInterval,
              }
            : null;
        }
      } else {
        // For every other conversions, we just use a rate of 0.
        for (const toAsset of toAssets) {
          conversionRates[fromKey][toAsset] = {
            rate: '0',
            conversionTime,
            expirationTime: conversionTime + 60 * 60 * 24, // Long expiration time (1 day) to avoid unnecessary requests
          };
        }
      }
    }

    return { conversionRates };
  }

  async historicalPrice(
    from: CaipAssetType,
    to: CaipAssetType,
  ): Promise<OnAssetHistoricalPriceResponse> {
    assert(from, CaipAssetTypeStruct);
    assert(to, CaipAssetTypeStruct);

    if (from !== (Caip19Asset.Bitcoin as CaipAssetType)) {
      return null;
    }

    try {
      const updateTime = getCurrentUnixTimestamp();
      const intervals = await this.#assetsUseCases.getPriceIntervals(to);

      return {
        historicalPrice: {
          intervals,
          updateTime,
          expirationTime: updateTime + this.#expirationInterval,
        },
      };
    } catch (error) {
      this.#logger.warn(
        'Failed to fetch historical prices from %s to %s. Error: %s',
        from,
        to,
        error,
      );
      return null;
    }
  }

  async marketData(
    assets: OnAssetsMarketDataArguments['assets'],
  ): Promise<OnAssetsMarketDataResponse> {
    // Group market data by "asset"
    const assetMap: Record<CaipAssetType, CaipAssetType[]> = {};
    for (const { asset, unit } of assets) {
      assetMap[asset] ??= [];
      assetMap[asset].push(unit);
    }

    const marketData: OnAssetsMarketDataResponse['marketData'] = {};

    for (const [fromAsset, toAssets] of Object.entries(assetMap)) {
      const fromKey = fromAsset as keyof typeof marketData;
      marketData[fromKey] = {};

      if (fromKey === (Caip19Asset.Bitcoin as CaipAssetType)) {
        // For Bitcoin, fetch market data.
        for (const [toAsset, rate] of await this.#assetsUseCases.getRates(
          toAssets,
        )) {
          marketData[fromKey][toAsset] = rate ? rate.marketData : null;
        }
      } else {
        // For every other assets, there is no market data.
        for (const toAsset of toAssets) {
          marketData[fromKey][toAsset] = null;
        }
      }
    }

    return { marketData };
  }
}
