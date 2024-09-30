import { BtcOnChainService } from './bitcoin/chain';
import { QuickNodeClient } from './bitcoin/chain/clients/quicknode';
import { BtcWallet } from './bitcoin/wallet';
import { Config } from './config';
import { Caip2ChainId } from './constants';
import { Factory } from './factory';

describe('Factory', () => {
  describe('createOnChainServiceProvider', () => {
    it('creates BtcOnChainService instance', () => {
      jest.spyOn(Factory, 'createQuickNodeClient').mockReturnThis();

      const instance = Factory.createOnChainServiceProvider(
        Caip2ChainId.Testnet,
      );

      expect(instance).toBeInstanceOf(BtcOnChainService);
    });
  });

  describe('createQuickNodeClient', () => {
    afterEach(() => {
      Config.onChainService.dataClient.options = {
        mainnetEndpoint: undefined,
        testnetEndpoint: undefined,
      };
    });

    it('creates CreateQuickNodeClient instance', () => {
      Config.onChainService.dataClient.options = {
        mainnetEndpoint: 'http://mainnetEndpoint',
        testnetEndpoint: 'http://testnetEndpoint',
      };

      const instance = Factory.createQuickNodeClient(Caip2ChainId.Testnet);

      expect(instance).toBeInstanceOf(QuickNodeClient);
    });

    it('throws `QuickNode endpoints have not configured` error if the endpoints does not provided', () => {
      Config.onChainService.dataClient.options = {
        mainnetEndpoint: undefined,
        testnetEndpoint: undefined,
      };

      expect(() => Factory.createQuickNodeClient(Caip2ChainId.Testnet)).toThrow(
        'QuickNode endpoints have not configured',
      );
    });
  });

  describe('createWallet', () => {
    it('creates BtcWallet instance', () => {
      const instance = Factory.createWallet(Caip2ChainId.Testnet);

      expect(instance).toBeInstanceOf(BtcWallet);
    });
  });
});
