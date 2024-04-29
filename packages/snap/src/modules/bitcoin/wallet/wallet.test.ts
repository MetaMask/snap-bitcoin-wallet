import { networks } from 'bitcoinjs-lib';

import { createMockBip32Instance } from '../../../../test/utils';
import { P2WPKHAccount } from './account';
import { BtcAccountBip32Deriver } from './deriver';
import { WalletError } from './exceptions';
import { BtcWallet } from './wallet';

describe('BtcWallet', () => {
  describe('unlock', () => {
    it('returns an `Account` object', async () => {
      const network = networks.testnet;
      const rootSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getRoot');
      const childSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getChild');
      const idx = 0;
      const { instance: rootNode } = createMockBip32Instance(network, idx);
      const { instance: childNode } = createMockBip32Instance(network, idx, 3);

      rootSpy.mockResolvedValue(rootNode);
      childSpy.mockResolvedValue(childNode);

      const instance = new BtcWallet(
        new BtcAccountBip32Deriver(network),
        P2WPKHAccount,
        network,
      );

      const result = await instance.unlock(idx);

      expect(result).toBeInstanceOf(P2WPKHAccount);
      expect(rootSpy).toHaveBeenCalledWith(P2WPKHAccount.path);
      expect(childSpy).toHaveBeenCalledWith(rootNode, idx);
    });

    it('throws error if the account cannot be unlocked', async () => {
      const network = networks.testnet;
      const rootSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getRoot');
      rootSpy.mockRejectedValue(new Error('Error'));

      const instance = new BtcWallet(
        new BtcAccountBip32Deriver(network),
        P2WPKHAccount,
        network,
      );

      await expect(instance.unlock(0)).rejects.toThrow(WalletError);
    });
  });
});
