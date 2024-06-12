import { BtcOnChainService } from './bitcoin/chain';
import { BtcWallet } from './bitcoin/wallet';
import { Caip2ChainId } from './constants';
import { Factory } from './factory';

describe('Factory', () => {
  describe('createOnChainServiceProvider', () => {
    it('creates BtcOnChainService instance', () => {
      const instance = Factory.createOnChainServiceProvider(
        Caip2ChainId.Testnet,
      );

      expect(instance).toBeInstanceOf(BtcOnChainService);
    });
  });

  describe('createWallet', () => {
    it('creates BtcWallet instance', () => {
      const instance = Factory.createWallet(Caip2ChainId.Testnet);

      expect(instance).toBeInstanceOf(BtcWallet);
    });
  });
});
