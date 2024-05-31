import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { createMockBip32Instance } from '../../../test/utils';
import { AccountSigner } from './signer';

describe('AccountSigner', () => {
  describe('derivePath', () => {
    it('returns an `AccountSigner` object', async () => {
      const network = networks.testnet;
      const {
        instance: node,
        deriveHardenedSpy,
        deriveSpy,
      } = createMockBip32Instance(network);

      const instance = new AccountSigner(node);

      const signer = instance.derivePath("m/0'/0/1");

      expect(deriveHardenedSpy).toHaveBeenCalledWith(0);
      expect(deriveSpy).toHaveBeenNthCalledWith(1, 0);
      expect(deriveSpy).toHaveBeenNthCalledWith(2, 1);
      expect(deriveHardenedSpy).toHaveBeenCalledTimes(1);
      expect(deriveSpy).toHaveBeenCalledTimes(2);
      expect(signer).toBeInstanceOf(AccountSigner);
    });

    it('throws error if an error catched', async () => {
      const network = networks.testnet;
      const { instance: node, deriveHardenedSpy } =
        createMockBip32Instance(network);
      deriveHardenedSpy.mockReturnValue(new Error('error'));

      const instance = new AccountSigner(node);

      expect(() => instance.derivePath("m/0'/0")).toThrow(
        'Unable to derive path',
      );
    });
  });

  describe('sign', () => {
    it('signs a message with a BIP32 instance', async () => {
      const network = networks.testnet;
      const { instance: node, signSpy } = createMockBip32Instance(network);
      const message = Buffer.from('test');

      const instance = new AccountSigner(node);
      const signer = instance.derivePath("m/0'/0/1");
      await signer.sign(message);

      expect(signSpy).toHaveBeenCalledWith(message);
    });
  });

  describe('verify', () => {
    it('verify a message with a BIP32 instance', () => {
      const network = networks.testnet;
      const { instance: node, verifySpy } = createMockBip32Instance(network);
      const hash = Buffer.from('hash');
      const signature = Buffer.from('signature');

      const instance = new AccountSigner(node);
      const signer = instance.derivePath("m/0'/0/1");
      signer.verify(hash, signature);

      expect(verifySpy).toHaveBeenCalledWith(hash, signature);
    });
  });
});
