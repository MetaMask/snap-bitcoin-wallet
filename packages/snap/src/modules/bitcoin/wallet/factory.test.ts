import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { ScriptType } from '../constants';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { BtcWalletFactory } from './factory';
import type { IBtcAccountDeriver, IStaticBtcAccount } from './types';
import * as manager from './wallet';

describe('BtcWalletFactory', () => {
  class MockBtcWallet extends manager.BtcWallet {
    getDeriver() {
      return this.deriver;
    }

    getAccountCtor() {
      return this.accountCtor;
    }
  }

  const createMockBtcWallet = () => {
    const spy = jest
      .spyOn(manager, 'BtcWallet')
      .mockImplementation(
        (
          deriver: IBtcAccountDeriver,
          account: IStaticBtcAccount,
          network: Network,
        ) => {
          return new MockBtcWallet(deriver, account, network);
        },
      );
    return {
      spy,
    };
  };

  describe('create', () => {
    it('creates BtcWallet instance with `BtcAccountBip32Deriver` and `P2WPKHAccount`', () => {
      const { spy } = createMockBtcWallet();

      const instance = BtcWalletFactory.create(
        {
          defaultAccountIndex: 0,
          defaultAccountType: ScriptType.P2wpkh,
          deriver: 'BIP32',
          enableMultiAccounts: false,
        },
        networks.testnet,
      ) as unknown as MockBtcWallet;

      expect(spy).toHaveBeenCalled();
      expect(instance.getDeriver()).toBeInstanceOf(BtcAccountBip32Deriver);
      expect(instance.getAccountCtor().name).toBe('P2WPKHAccount');
    });

    it('creates BtcWallet instance with `BtcAccountBip44Deriver` and `P2WPKHAccount`', () => {
      const { spy } = createMockBtcWallet();

      const instance = BtcWalletFactory.create(
        {
          defaultAccountIndex: 0,
          defaultAccountType: ScriptType.P2wpkh,
          deriver: 'BIP44',
          enableMultiAccounts: false,
        },
        networks.testnet,
      ) as unknown as MockBtcWallet;

      expect(spy).toHaveBeenCalled();
      expect(instance.getDeriver()).toBeInstanceOf(BtcAccountBip44Deriver);
      expect(instance.getAccountCtor().name).toBe('P2WPKHAccount');
    });

    it('throws `Invalid script type` if the given account type is not supported', () => {
      expect(() =>
        BtcWalletFactory.create(
          {
            defaultAccountIndex: 0,
            defaultAccountType: ScriptType.P2shP2wkh,
            deriver: 'BIP32',
            enableMultiAccounts: false,
          },
          networks.testnet,
        ),
      ).toThrow('Invalid script type');
    });
  });
});
