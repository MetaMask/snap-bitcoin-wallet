import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';
import type {
  CaipAssetType,
  FungibleAssetMetadata,
  OnAssetsConversionArguments,
  OnAssetsConversionResponse,
  OnAssetsLookupResponse,
} from '@metamask/snaps-sdk';
import type { Network } from 'bitcoindevkit';

import type { AssetsUseCases } from '../use-cases';
import { Caip19Asset } from './caip';
import { networkToIcon } from './icons';

export class AssetsHandler {
  readonly #assetsUseCases: AssetsUseCases;

  readonly #expirationInterval: number;

  constructor(assets: AssetsUseCases, expirationInterval: number) {
    this.#assetsUseCases = assets;
    this.#expirationInterval = expirationInterval;
  }

  lookup(): OnAssetsLookupResponse {
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
        symbol: '₿',
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

  async conversion({
    conversions,
  }: OnAssetsConversionArguments): Promise<OnAssetsConversionResponse> {
    const conversionTime = getCurrentUnixTimestamp();

    // Group conversions by "from"
    const assetMap: Record<CaipAssetType, CaipAssetType[]> = {};
    for (const { from, to } of conversions) {
      if (!assetMap[from]) {
        assetMap[from] = [];
      }
      assetMap[from].push(to);
    }

    const conversionRates: OnAssetsConversionResponse['conversionRates'] = {};
    for (const [fromAsset, toAssets] of Object.entries(assetMap)) {
      conversionRates[fromAsset] = {};

      if (fromAsset === Caip19Asset.Bitcoin) {
        // For Bitcoin, fetch rates.
        for (const [toAsset, rate] of await this.#assetsUseCases.getRates(
          toAssets,
        )) {
          conversionRates[fromAsset][toAsset] = rate
            ? {
                rate: rate.toString(),
                conversionTime,
                expirationTime: conversionTime + this.#expirationInterval,
              }
            : null;
        }
      } else {
        // For every other conversions, we just use a rate of 0.
        for (const toAsset of toAssets) {
          conversionRates[fromAsset][toAsset] = {
            rate: '0',
            conversionTime,
            expirationTime: conversionTime + 60 * 60 * 24, // Long expiration time (1 day) to avoid unnecessary requests
          };
        }
      }
    }

    return { conversionRates };
  }
}
