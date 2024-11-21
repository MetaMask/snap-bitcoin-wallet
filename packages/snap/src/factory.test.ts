import { BtcOnChainService } from './bitcoin/chain';
import { QuickNodeClient } from './bitcoin/chain/clients/quicknode';
import { SimpleHashClient } from './bitcoin/chain/clients/simplehash';
import { BtcWallet } from './bitcoin/wallet';
import { ApiClient, Config } from './config';
import { Caip2ChainId } from './constants';
import { Factory } from './factory';

describe('Factory', () => {
  describe('createOnChainServiceProvider', () => {
    it('creates BtcOnChainService instance', () => {
      jest.spyOn(Factory, 'createQuickNodeClient').mockReturnThis();
      jest.spyOn(Factory, 'createSimpleHashClient').mockReturnThis();

      const instance = Factory.createOnChainServiceProvider(
        Caip2ChainId.Testnet,
      );

      expect(instance).toBeInstanceOf(BtcOnChainService);
    });
  });

  describe('createQuickNodeClient', () => {
    const quickNodeConfig =
      Config.onChainService.apiClient[ApiClient.QuickNode];

    afterEach(() => {
      quickNodeConfig.options = {
        mainnetEndpoint: undefined,
        testnetEndpoint: undefined,
      };
    });

    it('creates CreateQuickNodeClient instance', () => {
      quickNodeConfig.options = {
        mainnetEndpoint: 'http://mainnetEndpoint',
        testnetEndpoint: 'http://testnetEndpoint',
      };

      const instance = Factory.createQuickNodeClient(Caip2ChainId.Testnet);

      expect(instance).toBeInstanceOf(QuickNodeClient);
    });

    it('throws `QuickNode endpoints have not been configured` error if the endpoints have not been provided', () => {
      quickNodeConfig.options = {
        mainnetEndpoint: undefined,
        testnetEndpoint: undefined,
      };

      expect(() => Factory.createQuickNodeClient(Caip2ChainId.Testnet)).toThrow(
        'QuickNode endpoints have not been configured',
      );
    });
  });

  describe('createSimpleHashClient', () => {
    const simpleHashConfig =
      Config.onChainService.apiClient[ApiClient.SimpleHash];

    afterEach(() => {
      simpleHashConfig.options = {
        apiKey: undefined,
      };
    });

    it('creates createSimpleHashClient instance', () => {
      simpleHashConfig.options = {
        apiKey: 'API_KEY',
      };

      const instance = Factory.createSimpleHashClient();

      expect(instance).toBeInstanceOf(SimpleHashClient);
    });

    it('throws `Simplehash API key has not been configured` error if the API key has not been provided', () => {
      expect(() => Factory.createSimpleHashClient()).toThrow(
        'Simplehash API key has not been configured',
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
