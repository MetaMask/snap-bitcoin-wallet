import type {
  FungibleAssetMetadata,
  OnAssetsConversionArguments,
  OnAssetsConversionResponse,
  OnAssetsLookupResponse,
} from '@metamask/snaps-sdk';

import type { AssetsUseCases } from '../use-cases';
import { Caip19Asset } from './caip19';

export class AssetsHandler {
  readonly #assetsUseCases: AssetsUseCases;

  constructor(assetsUseCases: AssetsUseCases) {
    this.#assetsUseCases = assetsUseCases;
  }

  lookup(): OnAssetsLookupResponse {
    const metadata = (
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
        iconUrl:
          'https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg',
        symbol: '₿',
      };
    };

    // Use the same denominations as Bitcoin for testnets but change the name and main unit symbol
    return {
      assets: {
        [Caip19Asset.Bitcoin]: metadata('Bitcoin', 'BTC'),
        [Caip19Asset.Testnet]: metadata('Testnet Bitcoin', 'tBTC'),
        [Caip19Asset.Testnet4]: metadata('Testnet4 Bitcoin', 'tBTC'),
        [Caip19Asset.Signet]: metadata('Signet Bitcoin', 'sBTC'),
        [Caip19Asset.Regtest]: metadata('Regtest Bitcoin', 'rBTC'),
      },
    };
  }

  async conversion(
    conversions: OnAssetsConversionArguments,
  ): Promise<OnAssetsConversionResponse> {
    // Validate the froms are only supported assets (caip19asset).

    const conversionRates = await this.#assetsUseCases.conversions(
      conversions.conversions,
    );
    return { conversionRates };
  }
}
