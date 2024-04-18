import {
  type BIP44AddressKeyDeriver,
  type SLIP10NodeInterface,
} from '@metamask/key-tree';
import * as bip32 from 'bip32';
import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { createMockBip32Instance } from '../../../../test/utils';
import { SnapHelper } from '../../snap';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';
import { DeriverError } from './exceptions';

jest.mock('bip32', () => {
  return {
    BIP32Factory: jest.fn(),
  };
});

const createMockBip32Factory = () => {
  const fromSeedSpy = jest.fn();
  const fromBase58Spy = jest.fn();
  const fromPrivateKeySpy = jest.fn();
  const fromPublicKeySpy = jest.fn();

  jest.spyOn(bip32, 'BIP32Factory').mockImplementation(() => {
    return {
      fromSeed: fromSeedSpy,
      fromBase58: fromBase58Spy,
      fromPrivateKey: fromPrivateKeySpy,
      fromPublicKey: fromPublicKeySpy,
    };
  });
  return {
    fromSeedSpy,
    fromBase58Spy,
    fromPrivateKeySpy,
    fromPublicKeySpy,
  };
};

describe('BtcAccountBip32Deriver', () => {
  const createMockBip32Entropy = () => {
    const getBip32DeriverSpy = jest.spyOn(SnapHelper, 'getBip32Deriver');
    const node = {
      privateKey: 'dddddddd',
      chainCode: 'dddddddd',
      publicKey: 'dddddddd',
      index: 0,
      depth: 0,
      parentFingerprint: 0,
      curve: 'secp256k1',
      chainCodeBytes: Buffer.from('dddddddd', 'hex'),
      publicKeyBytes: Buffer.from('dddddddd', 'hex'),
      toJSON: jest.fn(),
    };
    getBip32DeriverSpy.mockResolvedValue(
      node as unknown as SLIP10NodeInterface,
    );

    return {
      getBip32DeriverSpy,
      node,
    };
  };

  describe('fromSeed', () => {
    it('returns an BIP32Interface', () => {
      const network = networks.testnet;
      const { fromSeedSpy } = createMockBip32Factory();
      const seed = Buffer.from(
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        'hex',
      );

      const deriver = new BtcAccountBip32Deriver(network);
      deriver.fromSeed(seed);

      expect(fromSeedSpy).toHaveBeenCalledWith(seed, network);
    });
  });

  describe('fromPrivateKey', () => {
    it('returns an BIP32Interface', () => {
      const network = networks.testnet;
      const { fromPrivateKeySpy } = createMockBip32Factory();
      const privateKey = Buffer.from(
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        'hex',
      );
      const chainCode = Buffer.from(
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        'hex',
      );

      const deriver = new BtcAccountBip32Deriver(network);
      deriver.fromPrivateKey(privateKey, chainCode);

      expect(fromPrivateKeySpy).toHaveBeenCalledWith(
        privateKey,
        chainCode,
        network,
      );
    });
  });

  describe('getChild', () => {
    it('returns an BIP32Interface', async () => {
      const network = networks.testnet;
      const {
        instance: node,
        deriveHardenedSpy,
        deriveSpy,
      } = createMockBip32Instance(network);
      const idx = 0;

      const deriver = new BtcAccountBip32Deriver(network);
      await deriver.getChild(node, idx);

      expect(deriveHardenedSpy).toHaveBeenCalledWith(0);
      expect(deriveSpy).toHaveBeenNthCalledWith(1, 0);
      expect(deriveSpy).toHaveBeenNthCalledWith(2, idx);
      expect(deriveSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRoot', () => {
    it('returns an BIP32Interface', async () => {
      const network = networks.testnet;
      const { getBip32DeriverSpy, node } = createMockBip32Entropy();
      const { fromPrivateKeySpy } = createMockBip32Factory();
      fromPrivateKeySpy.mockReturnValue(node);
      const path = ['m', "84'", "0'"];
      const curve = 'secp256k1';

      const deriver = new BtcAccountBip32Deriver(network);
      const root = await deriver.getRoot(path);

      expect(getBip32DeriverSpy).toHaveBeenCalledWith(path, curve);
      expect(fromPrivateKeySpy).toHaveBeenCalledWith(
        Buffer.from(node.privateKey, 'hex'),
        Buffer.from(node.chainCode, 'hex'),
        network,
      );
      expect(root).toStrictEqual(node);
    });

    it('throws DeriverError if private key is missing', async () => {
      const network = networks.testnet;
      const path = ['m', "84'", "0'"];
      const { getBip32DeriverSpy } = createMockBip32Entropy();

      getBip32DeriverSpy.mockResolvedValue({
        privateKey: undefined,
        chainCode: 'dddddddd',
        publicKey: 'dddddddd',
        index: 0,
        depth: 0,
        parentFingerprint: 0,
        curve: 'secp256k1',
        chainCodeBytes: Buffer.from('dddddddd', 'hex'),
        publicKeyBytes: Buffer.from('dddddddd', 'hex'),
        toJSON: jest.fn(),
      });

      const deriver = new BtcAccountBip32Deriver(network);

      await expect(deriver.getRoot(path)).rejects.toThrow(
        'Deriver private key is missing',
      );
    });

    it('throws DeriverError if an error catched', async () => {
      const network = networks.testnet;
      const path = ['m', "84'", "0'"];
      const { getBip32DeriverSpy } = createMockBip32Entropy();
      getBip32DeriverSpy.mockRejectedValue(new Error('error'));

      const deriver = new BtcAccountBip32Deriver(network);

      await expect(deriver.getRoot(path)).rejects.toThrow(DeriverError);
    });
  });
});

describe('BtcAccountBip44Deriver', () => {
  const createMockBip44Entropy = () => {
    const getBip44DeriverSpy = jest.spyOn(SnapHelper, 'getBip44Deriver');
    const deriverSpy = jest.fn();

    getBip44DeriverSpy.mockResolvedValue(
      deriverSpy as unknown as BIP44AddressKeyDeriver,
    );

    return {
      deriverSpy,
      getBip44DeriverSpy,
    };
  };

  describe('getRoot', () => {
    it('returns an BIP32Interface', async () => {
      const network = networks.testnet;
      const path = ['m', "84'", "0'"];
      const privateKey = 'dddddddd';
      const { instance, deriveHardenedSpy } = createMockBip32Instance(network);
      const { fromSeedSpy } = createMockBip32Factory();
      const { getBip44DeriverSpy, deriverSpy } = createMockBip44Entropy();
      fromSeedSpy.mockReturnValue(instance);
      deriverSpy.mockResolvedValue({
        privateKey,
      });

      const deriver = new BtcAccountBip44Deriver(network);
      await deriver.getRoot(path);

      expect(getBip44DeriverSpy).toHaveBeenCalledWith(0);
      expect(fromSeedSpy).toHaveBeenCalledWith(
        Buffer.from(privateKey, 'hex'),
        network,
      );
      expect(deriveHardenedSpy).toHaveBeenNthCalledWith(
        1,
        parseInt(path[1].slice(0, -1), 10),
      );
      expect(deriveHardenedSpy).toHaveBeenNthCalledWith(2, 0);
      expect(deriveHardenedSpy).toHaveBeenCalledTimes(2);
    });

    it('throws DeriverError if the private key is missing', async () => {
      const network = networks.testnet;
      const path = ['m', "84'", "0'"];
      const { deriverSpy } = createMockBip44Entropy();
      deriverSpy.mockResolvedValue({
        privateKey: undefined,
      });

      const deriver = new BtcAccountBip44Deriver(network);

      await expect(deriver.getRoot(path)).rejects.toThrow(
        'Deriver private key is missing',
      );
    });

    it('throws DeriverError if an error catched', async () => {
      const network = networks.testnet;
      const path = ['m', "84'", "0'"];
      const { deriverSpy } = createMockBip44Entropy();
      deriverSpy.mockRejectedValue(new Error('error'));

      const deriver = new BtcAccountBip44Deriver(network);

      await expect(deriver.getRoot(path)).rejects.toThrow(DeriverError);
    });
  });
});
