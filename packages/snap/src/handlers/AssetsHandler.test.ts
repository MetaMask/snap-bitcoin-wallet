import { mock } from 'jest-mock-extended';

import type { AssetsUseCases } from '../use-cases';
import { AssetsHandler } from './AssetsHandler';
import { Caip19Asset } from './caip19';

describe('AssetsHandler', () => {
  const mockAssetsUseCases = mock<AssetsUseCases>();
  const exirationInterval = 60;

  let handler: AssetsHandler;

  beforeEach(() => {
    handler = new AssetsHandler(mockAssetsUseCases, exirationInterval);
  });

  describe('lookup', () => {
    it('returns data for all networks', () => {
      const result = handler.lookup();

      expect(result.assets[Caip19Asset.Bitcoin]?.name).toBe('Bitcoin');
      expect(result.assets[Caip19Asset.Testnet]?.name).toBe('Testnet Bitcoin');
      expect(result.assets[Caip19Asset.Testnet4]?.name).toBe(
        'Testnet4 Bitcoin',
      );
      expect(result.assets[Caip19Asset.Signet]?.name).toBe('Signet Bitcoin');
      expect(result.assets[Caip19Asset.Regtest]?.name).toBe('Regtest Bitcoin');
    });
  });

  describe('conversion', () => {
    it('returns 0 rates if from is not Bitcoin', async () => {
      const conversions = [
        { from: Caip19Asset.Testnet, to: Caip19Asset.Bitcoin },
      ];
      const result = await handler.conversion({ conversions });

      expect(result.conversionRates).toStrictEqual({
        [Caip19Asset.Testnet]: {
          [Caip19Asset.Bitcoin]: {
            rate: '0',
            conversionTime: expect.any(Number),
            expirationTime: expect.any(Number),
          },
        },
      });
    });

    it('returns rates for Bitcoin', async () => {
      const conversions = [
        { from: Caip19Asset.Bitcoin, to: Caip19Asset.Testnet },
        { from: Caip19Asset.Bitcoin, to: Caip19Asset.Regtest },
      ];
      mockAssetsUseCases.getRates.mockResolvedValue([
        [Caip19Asset.Testnet, 0.1],
        [Caip19Asset.Regtest, 0.2],
      ]);
      const result = await handler.conversion({ conversions });

      expect(result.conversionRates).toStrictEqual({
        [Caip19Asset.Bitcoin]: {
          [Caip19Asset.Testnet]: {
            rate: '0.1',
            conversionTime: expect.any(Number),
            expirationTime: expect.any(Number),
          },
          [Caip19Asset.Regtest]: {
            rate: '0.2',
            conversionTime: expect.any(Number),
            expirationTime: expect.any(Number),
          },
        },
      });
    });

    it('propagates errors from getBtcRates', async () => {
      const conversions = [
        { from: Caip19Asset.Bitcoin, to: Caip19Asset.Testnet },
      ];
      const error = new Error();
      mockAssetsUseCases.getRates.mockRejectedValue(error);

      await expect(handler.conversion({ conversions })).rejects.toThrow(error);
    });
  });
});
