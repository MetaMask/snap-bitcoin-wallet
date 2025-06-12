import type { HistoricalPriceValue } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { AssetRatesClient, Logger, SpotPrice } from '../entities';
import { AssetsUseCases } from './AssetsUseCases';
import { Caip19Asset } from '../handlers/caip';

describe('AssetsUseCases', () => {
  const mockLogger = mock<Logger>();
  const mockAssetRates = mock<AssetRatesClient>();

  const useCases = new AssetsUseCases(mockLogger, mockAssetRates);

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
        ['swift:0/unknown:unknown', null],
        ['eip155:1/slip44:60', mockExchangeRatesETH],
        [
          'bip122:000000000019d6689c085ae165831e93/slip44:0',
          mockExchangeRatesBTC,
        ],
        ['swift:0/iso4217:USD', mockExchangeRatesUSD],
      ]);
    });

    it('propagates an error if spotPrices fails', async () => {
      const error = new Error('getRates failed');
      mockAssetRates.spotPrices.mockRejectedValue(error);

      await expect(useCases.getRates([Caip19Asset.Testnet])).rejects.toBe(
        error,
      );
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

    it('propagates an error if historicalPrices fails', async () => {
      const error = new Error('historicalPrices failed');
      mockAssetRates.historicalPrices.mockRejectedValue(error);

      await expect(
        useCases.getPriceIntervals('swift:0/iso4217:USD'),
      ).rejects.toBe(error);
    });
  });
});
