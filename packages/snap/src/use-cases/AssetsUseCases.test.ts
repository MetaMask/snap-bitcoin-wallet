import { mock } from 'jest-mock-extended';

import type { AssetRatesClient, ExchangeRates } from '../entities';
import { Caip19Asset } from '../handlers/caip';
import type { ILogger } from '../infra/logger';
import { AssetsUseCases } from './AssetsUseCases';

jest.mock('../infra/logger', () => {
  return { logger: mock<ILogger>() };
});

describe('AssetsUseCases', () => {
  let useCases: AssetsUseCases;

  const mockAssetRates = mock<AssetRatesClient>();

  beforeEach(() => {
    useCases = new AssetsUseCases(mockAssetRates);
  });

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
      const error = new Error('Get failed');
      mockAssetRates.exchangeRates.mockRejectedValue(error);

      await expect(useCases.getRates([Caip19Asset.Testnet])).rejects.toBe(
        error,
      );
    });
  });
});
