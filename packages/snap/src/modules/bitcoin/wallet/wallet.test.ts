import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { createMockBip32Instance } from '../../../../test/utils';
import { ScriptType } from '../constants';
import { P2SHP2WPKHAccount, P2WPKHAccount } from './account';
import { BtcAccountBip32Deriver } from './deriver';
import { WalletError } from './exceptions';
import { BtcWallet } from './wallet';

describe('BtcWallet', () => {
  const createMockWallet = (network) => {
    const rootSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getRoot');
    const childSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getChild');
    const idx = 0;
    const { instance: rootNode } = createMockBip32Instance(network, idx);
    const { instance: childNode } = createMockBip32Instance(network, idx, 3);

    rootSpy.mockResolvedValue(rootNode);
    childSpy.mockResolvedValue(childNode);

    const instance = new BtcWallet(
      new BtcAccountBip32Deriver(network),
      network,
    );
    return {
      instance,
      rootSpy,
      childSpy,
      rootNode,
      childNode,
    };
  };

  describe('unlock', () => {
    it('returns an `Account` objec with type bip122:p2wpkh', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance, rootNode } =
        createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, `bip122:p2wpkh`);

      expect(result).toBeInstanceOf(P2WPKHAccount);
      expect(rootSpy).toHaveBeenCalledWith(P2WPKHAccount.path);
      expect(childSpy).toHaveBeenCalledWith(rootNode, idx);
    });

    it('returns an `Account` objec with type `p2wpkh`', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance, rootNode } =
        createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, ScriptType.P2wpkh);

      expect(result).toBeInstanceOf(P2WPKHAccount);
      expect(rootSpy).toHaveBeenCalledWith(P2WPKHAccount.path);
      expect(childSpy).toHaveBeenCalledWith(rootNode, idx);
    });

    it('returns an `Account` object with type `p2shp2wkh`', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance, rootNode } =
        createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, ScriptType.P2shP2wkh);

      expect(result).toBeInstanceOf(P2SHP2WPKHAccount);
      expect(rootSpy).toHaveBeenCalledWith(P2SHP2WPKHAccount.path);
      expect(childSpy).toHaveBeenCalledWith(rootNode, idx);
    });

    it('throws `Unable to get fingerprint in hex` error if the fingerprint can not toString', async () => {
      const network = networks.testnet;
      const idx = 0;
      const { instance, rootNode } = createMockWallet(network);
      rootNode.fingerprint = undefined as unknown as Buffer;

      await expect(instance.unlock(idx, ScriptType.P2wpkh)).rejects.toThrow(
        `Unable to get fingerprint in hex`,
      );
    });

    it('throws `Unable to get public key in hex` error if the fingerprint can not toString', async () => {
      const network = networks.testnet;
      const idx = 0;
      const { instance, childNode } = createMockWallet(network);
      childNode.publicKey = undefined as unknown as Buffer;

      await expect(instance.unlock(idx, ScriptType.P2wpkh)).rejects.toThrow(
        `Unable to get public key in hex`,
      );
    });

    it('throws error if the account cannot be unlocked', async () => {
      const network = networks.testnet;
      const idx = 0;
      const { instance } = createMockWallet(network);

      await expect(instance.unlock(idx, ScriptType.P2pkh)).rejects.toThrow(
        WalletError,
      );
    });
  });

  describe('createTransaction', () => {
    it('throws `Method not implemented` error', async () => {
      const network = networks.testnet;
      const idx = 0;
      const { instance } = createMockWallet(network);

      const account = await instance.unlock(idx, ScriptType.P2wpkh);

      await expect(
        instance.createTransaction(account, {} as any, {} as any),
      ).rejects.toThrow('Method not implemented.');
    });
  });

  describe('signTransaction', () => {
    it('throws `Method not implemented` error', async () => {
      const network = networks.testnet;
      const idx = 0;
      const { instance } = createMockWallet(network);

      const account = await instance.unlock(idx, ScriptType.P2wpkh);

      await expect(
        instance.signTransaction(
          account.signer,
          Buffer.from('0x12312313', 'hex'),
        ),
      ).rejects.toThrow('Method not implemented.');
    });
  });
});
