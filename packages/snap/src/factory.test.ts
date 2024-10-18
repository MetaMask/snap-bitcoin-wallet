import { BtcOnChainService } from './bitcoin/chain';
import { QuickNodeClient } from './bitcoin/chain/clients/quicknode';
import { BtcWallet } from './bitcoin/wallet';
import { ApiClient, Config } from './config';
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
      Config.onChainService.apiClient[ApiClient.QuickNode].options = {
        mainnetEndpoint: undefined,
        testnetEndpoint: undefined,
      };
    });

    it('creates CreateQuickNodeClient instance', () => {
      Config.onChainService.apiClient[ApiClient.QuickNode].options = {
        mainnetEndpoint: 'http://mainnetEndpoint',
        testnetEndpoint: 'http://testnetEndpoint',
      };

      const instance = Factory.createQuickNodeClient(Caip2ChainId.Testnet);

      expect(instance).toBeInstanceOf(QuickNodeClient);
    });

    it('throws `QuickNode endpoints have not been configured` error if the endpoints have not been provided', () => {
      Config.onChainService.apiClient[ApiClient.QuickNode].options = {
        mainnetEndpoint: undefined,
        testnetEndpoint: undefined,
      };

      expect(() => Factory.createQuickNodeClient(Caip2ChainId.Testnet)).toThrow(
        'QuickNode endpoints have not been configured',
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
