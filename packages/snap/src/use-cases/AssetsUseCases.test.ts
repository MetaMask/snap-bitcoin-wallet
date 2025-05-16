import type { HistoricalPriceValue } from '@metamask/snaps-sdk';
import { mock } from 'jest-mock-extended';

import type { AssetRatesClient, ExchangeRates, Logger } from '../entities';
import { AssetsUseCases } from './AssetsUseCases';
import { Caip19Asset } from '../handlers/caip';

describe('AssetsUseCases', () => {
  const mockLogger = mock<Logger>();
  const mockAssetRates = mock<AssetRatesClient>();

  const useCases = new AssetsUseCases(mockLogger, mockAssetRates);

  describe('getBtcRates', () => {
    it('returns rate for the known assets and null for unknown', async () => {
      const mockExchangeRates = mock<ExchangeRates>({
        usd: { value: 1 },
        eth: { value: 2 },
        btc: { value: 3 },
      });

      mockAssetRates.exchangeRates.mockResolvedValue(mockExchangeRates);

      const result = await useCases.getRates([
        'eip155:1/slip44:60',
        'bip122:000000000019d6689c085ae165831e93/slip44:0',
        'swift:0/iso4217:USD',
        'swift:0/unknown:unknown',
      ]);

      expect(mockAssetRates.exchangeRates).toHaveBeenCalled();
      expect(result).toStrictEqual([
        ['eip155:1/slip44:60', 2],
        ['bip122:000000000019d6689c085ae165831e93/slip44:0', 3],
        ['swift:0/iso4217:USD', 1],
        ['swift:0/unknown:unknown', null],
      ]);
    });

    it('propagates an error if exchangeRates fails', async () => {
      const error = new Error('getRates failed');
      mockAssetRates.exchangeRates.mockRejectedValue(error);

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

    it('does not fail if historicalPrices returns an error', async () => {
      const error = new Error('historicalPrices failed');
      mockAssetRates.historicalPrices.mockRejectedValue(error);

      const result = await useCases.getPriceIntervals('swift:0/iso4217:USD');
      expect(result).toStrictEqual({});
    });
  });
});
