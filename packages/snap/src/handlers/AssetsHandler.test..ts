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
      expect(result.assets[Caip19Asset.Bitcoin]?.name).toEqual('Bitcoin');
      expect(result.assets[Caip19Asset.Bitcoin]?.name).toEqual(
        'Testnet Bitcoin',
      );
      expect(result.assets[Caip19Asset.Bitcoin]?.name).toEqual(
        'Testnet4 Bitcoin',
      );
      expect(result.assets[Caip19Asset.Bitcoin]?.name).toEqual(
        'Signet Bitcoin',
      );
      expect(result.assets[Caip19Asset.Bitcoin]?.name).toEqual(
        'Regtest Bitcoin',
      );
    });
  });

  describe('conversion', () => {
    it('returns empty record', () => {
      const result = handler.conversion();
      expect(result).toEqual({});
    });
  });
});
