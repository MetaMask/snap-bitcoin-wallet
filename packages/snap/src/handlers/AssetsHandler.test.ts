import { AssetsHandler } from './AssetsHandler';
import { Caip19Asset } from './caip19';

describe('AssetsHandler', () => {
  let handler: AssetsHandler;

  beforeEach(() => {
    handler = new AssetsHandler();
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
    it('returns empty record', () => {
      const result = handler.conversion();
      expect(result.conversionRates).toStrictEqual({});
    });
  });
});
