import type { HistoricalPriceValue } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { AssetRatesClient, Logger, SpotPrice } from '../entities';
import { AssetsUseCases } from './AssetsUseCases';
import { Caip19Asset } from '../handlers/caip';
import type { ICache, Serializable } from '../store/ICache';

describe('AssetsUseCases', () => {
  const mockLogger = mock<Logger>();
  const mockAssetRates = mock<AssetRatesClient>();
  const mockCache = mock<ICache<Serializable>>();

  const useCases = new AssetsUseCases(mockLogger, mockAssetRates, mockCache);

  describe('getBtcRates', () => {
    it('returns rate for the known assets and null for unknown', async () => {
      const mockExchangeRatesUSD = mock<SpotPrice>({
        price: 1,
        marketData: {
          allTimeHigh: '110000',
        },
      });
      const mockExchangeRatesETH = mock<SpotPrice>({
        price: 1,
        marketData: {
          allTimeHigh: '0.1',
        },
      });
      const mockExchangeRatesBTC = mock<SpotPrice>({
        price: 1,
        marketData: {
          allTimeHigh: '1',
        },
      });

      mockCache.get.mockResolvedValue(undefined);
      mockAssetRates.spotPrices.mockResolvedValueOnce(mockExchangeRatesETH);
      mockAssetRates.spotPrices.mockResolvedValueOnce(mockExchangeRatesBTC);
      mockAssetRates.spotPrices.mockResolvedValueOnce(mockExchangeRatesUSD);

      const result = await useCases.getRates([
        'eip155:1/slip44:60',
        'bip122:000000000019d6689c085ae165831e93/slip44:0',
        'swift:0/iso4217:USD',
        'swift:0/unknown:unknown',
      ]);

      expect(mockAssetRates.spotPrices).toHaveBeenCalled();
      expect(result).toStrictEqual([
        ['eip155:1/slip44:60', mockExchangeRatesETH],
        [
          'bip122:000000000019d6689c085ae165831e93/slip44:0',
          mockExchangeRatesBTC,
        ],
        ['swift:0/iso4217:USD', mockExchangeRatesUSD],
        ['swift:0/unknown:unknown', null],
      ]);
    });

    it('returns null for assets when spotPrices fails', async () => {
      const error = new Error('getRates failed');
      mockCache.get.mockResolvedValue(undefined);
      mockAssetRates.spotPrices.mockRejectedValue(error);

      const result = await useCases.getRates([Caip19Asset.Testnet]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch spot price for ticker btc',
        error,
      );
      expect(result).toStrictEqual([[Caip19Asset.Testnet, null]]);
    });

    it('uses cached values when available', async () => {
      const cachedSpotPrice = mock<SpotPrice>({
        price: 42000,
        marketData: {
          allTimeHigh: '110000',
        },
      });

      mockCache.get.mockResolvedValue(cachedSpotPrice);

      const result = await useCases.getRates(['swift:0/iso4217:USD']);

      expect(mockCache.get).toHaveBeenCalledWith('spotPrices:usd');
      expect(mockAssetRates.spotPrices).not.toHaveBeenCalled();
      expect(result).toStrictEqual([['swift:0/iso4217:USD', cachedSpotPrice]]);
    });

    it('caches fetched spot prices with 30 second TTL', async () => {
      const mockSpotPrice = mock<SpotPrice>({
        price: 50000,
        marketData: {
          allTimeHigh: '110000',
        },
      });

      mockCache.get.mockResolvedValue(undefined);
      mockAssetRates.spotPrices.mockResolvedValue(mockSpotPrice);

      await useCases.getRates(['swift:0/iso4217:USD']);

      expect(mockCache.set).toHaveBeenCalledWith(
        'spotPrices:usd',
        mockSpotPrice,
        30000,
      );
    });

    it('deduplicates requests for assets with the same ticker', async () => {
      const mockSpotPrice = mock<SpotPrice>({
        price: 50000,
        marketData: {
          allTimeHigh: '110000',
        },
      });

      // First call to cache.get returns undefined (cache miss)
      // Subsequent calls return the cached value (cache hit)
      mockCache.get
        .mockResolvedValueOnce(undefined)
        .mockResolvedValue(mockSpotPrice);
      mockAssetRates.spotPrices.mockResolvedValue(mockSpotPrice);

      // Multiple assets that map to the same ticker (usd)
      const result = await useCases.getRates([
        'swift:0/iso4217:USD',
        'swift:1/iso4217:USD',
        'swift:2/iso4217:USD',
      ]);

      // Should only call spotPrices once for the unique ticker
      expect(mockAssetRates.spotPrices).toHaveBeenCalledTimes(1);
      expect(mockAssetRates.spotPrices).toHaveBeenCalledWith('usd');

      // All assets should get the same spot price
      expect(result).toStrictEqual([
        ['swift:0/iso4217:USD', mockSpotPrice],
        ['swift:1/iso4217:USD', mockSpotPrice],
        ['swift:2/iso4217:USD', mockSpotPrice],
      ]);
    });
  });

  describe('getPriceIntervals', () => {
    it('returns prices against the specified token', async () => {
      const mockHistoricalPrices = mock<HistoricalPriceValue[]>();
      mockAssetRates.historicalPrices.mockResolvedValue(mockHistoricalPrices);

      const result = await useCases.getPriceIntervals('swift:0/iso4217:USD');

      expect(mockAssetRates.historicalPrices).toHaveBeenCalledTimes(6);
      expect(result).toStrictEqual({
        P1D: mockHistoricalPrices,
        P7D: mockHistoricalPrices,
        P1M: mockHistoricalPrices,
        P3M: mockHistoricalPrices,
        P1Y: mockHistoricalPrices,
        P1000Y: mockHistoricalPrices,
      });
    });

    it('returns empty arrays for periods when historicalPrices fails', async () => {
      const error = new Error('historicalPrices failed');
      mockAssetRates.historicalPrices.mockRejectedValue(error);

      const result = await useCases.getPriceIntervals('swift:0/iso4217:USD');

      expect(mockLogger.warn).toHaveBeenCalledTimes(6);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to fetch historical prices for period P1D',
        error,
      );
      expect(result).toStrictEqual({
        P1D: [],
        P7D: [],
        P1M: [],
        P3M: [],
        P1Y: [],
        P1000Y: [],
      });
    });
  });
});
