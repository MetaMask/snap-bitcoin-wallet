import { BtcOnChainService } from './bitcoin/chain';
import { Network } from './bitcoin/constants';
import { BtcWallet } from './bitcoin/wallet';
import { Factory } from './factory';

describe('Factory', () => {
  describe('createOnChainServiceProvider', () => {
    it('creates BtcOnChainService instance', () => {
      const instance = Factory.createOnChainServiceProvider(Network.Testnet);

      expect(instance).toBeInstanceOf(BtcOnChainService);
    });
  });

  describe('createWallet', () => {
    it('creates BtcWallet instance', () => {
      const instance = Factory.createWallet(Network.Testnet);

      expect(instance).toBeInstanceOf(BtcWallet);
    });
  });
});
