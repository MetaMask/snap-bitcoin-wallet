import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { ScriptType } from './constants';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { BtcAccountMgrFactory } from './factory';
import * as manager from './manager';
import type { IBtcAccountDeriver, IStaticBtcAccount } from './types';

describe('BtcAccountMgrFactory', () => {
  class MockBtcAccountMgr extends manager.BtcAccountMgr {
    getDeriver() {
      return this.deriver;
    }

    getAccountCtor() {
      return this.accountCtor;
    }
  }

  const createMockBtcAccountMgr = () => {
    const spy = jest
      .spyOn(manager, 'BtcAccountMgr')
      .mockImplementation(
        (
          deriver: IBtcAccountDeriver,
          account: IStaticBtcAccount,
          network: Network,
        ) => {
          return new MockBtcAccountMgr(deriver, account, network);
        },
      );
    return {
      spy,
    };
  };

  describe('create', () => {
    it('creates BtcAccountMgr instance with `BtcAccountBip32Deriver` and `P2WPKHAccount`', () => {
      const { spy } = createMockBtcAccountMgr();

      const instance = BtcAccountMgrFactory.create(
        {
          defaultAccountIndex: 0,
          defaultAccountType: ScriptType.P2wpkh,
          deriver: 'BIP32',
          enableMultiAccounts: false,
        },
        networks.testnet,
      ) as unknown as MockBtcAccountMgr;

      expect(spy).toHaveBeenCalled();
      expect(instance.getDeriver()).toBeInstanceOf(BtcAccountBip32Deriver);
      expect(instance.getAccountCtor().name).toBe('P2WPKHAccount');
    });

    it('creates BtcAccountMgr instance with `BtcAccountBip44Deriver` and `P2WPKHAccount`', () => {
      const { spy } = createMockBtcAccountMgr();

      const instance = BtcAccountMgrFactory.create(
        {
          defaultAccountIndex: 0,
          defaultAccountType: ScriptType.P2wpkh,
          deriver: 'BIP44',
          enableMultiAccounts: false,
        },
        networks.testnet,
      ) as unknown as MockBtcAccountMgr;

      expect(spy).toHaveBeenCalled();
      expect(instance.getDeriver()).toBeInstanceOf(BtcAccountBip44Deriver);
      expect(instance.getAccountCtor().name).toBe('P2WPKHAccount');
    });

    it('throws `Invalid script type` if the given account type is not supported', () => {
      expect(() =>
        BtcAccountMgrFactory.create(
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
