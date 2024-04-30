import { Chain } from '../config';
import { BtcOnChainService } from './bitcoin/chain';
import { Network } from './bitcoin/constants';
import { BtcWallet } from './bitcoin/wallet';
import { Factory } from './factory';
import { BtcKeyring } from './keyring';

describe('Factory', () => {
  describe('createOnChainServiceProvider', () => {
    it('creates BtcOnChainService instance', () => {
      const instance = Factory.createOnChainServiceProvider(
        Chain.Bitcoin,
        Network.Testnet,
      );

      expect(instance).toBeInstanceOf(BtcOnChainService);
    });
  });

  describe('createWallet', () => {
    it('creates BtcWallet instance', () => {
      const instance = Factory.createWallet(Chain.Bitcoin, Network.Testnet);

      expect(instance).toBeInstanceOf(BtcWallet);
    });
  });

  describe('createKeyring', () => {
    it('creates BtcKeyring instance', () => {
      const instance = Factory.createKeyring(Chain.Bitcoin);

      expect(instance).toBeInstanceOf(BtcKeyring);
    });
  });
});
