import { Chain } from '../config';
import { BtcAccountMgr } from './bitcoin/account';
import { Network } from './bitcoin/constants';
import { BtcTransactionMgr } from './bitcoin/transaction';
import { Factory } from './factory';
import { BtcKeyring } from './keyring';

describe('Factory', () => {
  describe('createTransactionMgr', () => {
    it('creates BtcTransactionMgr instance', () => {
      const instance = Factory.createTransactionMgr(
        Chain.Bitcoin,
        Network.Testnet,
      );

      expect(instance).toBeInstanceOf(BtcTransactionMgr);
    });
  });

  describe('createAccountMgr', () => {
    it('creates BtcAccountMgr instance', () => {
      const instance = Factory.createAccountMgr(Chain.Bitcoin, Network.Testnet);

      expect(instance).toBeInstanceOf(BtcAccountMgr);
    });
  });

  describe('createKeyring', () => {
    it('creates BtcKeyring instance', () => {
      const instance = Factory.createKeyring(Chain.Bitcoin);

      expect(instance).toBeInstanceOf(BtcKeyring);
    });
  });
});
