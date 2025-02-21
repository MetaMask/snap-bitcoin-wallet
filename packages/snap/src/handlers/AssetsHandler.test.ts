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
      console.log(result);

      expect(result.assets[Caip19Asset.Bitcoin]?.name).toEqual('Bitcoin');
      expect(result.assets[Caip19Asset.Testnet]?.name).toEqual(
        'Testnet Bitcoin',
      );
      expect(result.assets[Caip19Asset.Testnet4]?.name).toEqual(
        'Testnet4 Bitcoin',
      );
      expect(result.assets[Caip19Asset.Signet]?.name).toEqual('Signet Bitcoin');
      expect(result.assets[Caip19Asset.Regtest]?.name).toEqual(
        'Regtest Bitcoin',
      );
    });
  });

  describe('conversion', () => {
    it('returns empty record', () => {
      const result = handler.conversion();
      expect(result.conversionRates).toEqual({});
    });
  });
});
