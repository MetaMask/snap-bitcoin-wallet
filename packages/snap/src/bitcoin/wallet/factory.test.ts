import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { BtcWalletFactory } from './factory';
import type { IBtcAccountDeriver } from './types';
import * as manager from './wallet';

describe('BtcWalletFactory', () => {
  class MockBtcWallet extends manager.BtcWallet {
    getDeriver() {
      return this._deriver;
    }
  }

  const createMockBtcWallet = () => {
    const spy = jest
      .spyOn(manager, 'BtcWallet')
      .mockImplementation((deriver: IBtcAccountDeriver, network: Network) => {
        return new MockBtcWallet(deriver, network);
      });
    return {
      spy,
    };
  };

  describe('create', () => {
    it('creates BtcWallet instance with `BtcAccountBip32Deriver`', () => {
      const { spy } = createMockBtcWallet();

      const instance = BtcWalletFactory.create(
        'BIP32',
        networks.testnet,
      ) as unknown as MockBtcWallet;

      expect(spy).toHaveBeenCalled();
      expect(instance.getDeriver()).toBeInstanceOf(BtcAccountBip32Deriver);
    });

    it('creates BtcWallet instance with `BtcAccountBip44Deriver`', () => {
      const { spy } = createMockBtcWallet();

      const instance = BtcWalletFactory.create(
        'BIP44',
        networks.testnet,
      ) as unknown as MockBtcWallet;

      expect(spy).toHaveBeenCalled();
      expect(instance.getDeriver()).toBeInstanceOf(BtcAccountBip44Deriver);
    });
  });
});
