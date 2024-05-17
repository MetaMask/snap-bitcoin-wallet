import { Factory } from './factory';
import { BtcKeyring } from './keyring';
import { BtcOnChainService } from './modules/bitcoin/chain';
import { Network } from './modules/bitcoin/constants';
import { BtcWallet } from './modules/bitcoin/wallet';

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

  describe('createKeyring', () => {
    it('creates BtcKeyring instance', () => {
      const instance = Factory.createKeyring();

      expect(instance).toBeInstanceOf(BtcKeyring);
    });
  });
});
