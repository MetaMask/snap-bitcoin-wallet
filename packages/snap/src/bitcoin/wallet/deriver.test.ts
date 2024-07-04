import ecc from '@bitcoinerlab/secp256k1';
import {
  type BIP44AddressKeyDeriver,
  type SLIP10NodeInterface,
} from '@metamask/key-tree';
import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import ECPairFactory from 'ecpair';

import { SnapHelper } from '../../libs/snap';
import * as strUtils from '../../utils/string';
import { P2WPKHAccount } from './account';
import { BtcAccountBip32Deriver, BtcAccountBip44Deriver } from './deriver';

jest.mock('../../libs/snap/helpers');

describe('BtcAccountBip32Deriver', () => {
  const prepareBip32Deriver = async (network) => {
    const deriver = new BtcAccountBip32Deriver(network);
    const bip32Deriver = await SnapHelper.getBip32Deriver(
      P2WPKHAccount.path,
      deriver.curve,
    );
    const pkBuffer = bip32Deriver.privateKeyBytes as unknown as Buffer;
    const ccBuffer = bip32Deriver.chainCodeBytes as unknown as Buffer;

    return {
      bip32Deriver,
      deriver,
      pkBuffer,
      ccBuffer,
    };
  };

  describe('createBip32FromSeed', () => {
    it('returns an BIP32Interface', async () => {
      const network = networks.testnet;
      const { deriver, pkBuffer } = await prepareBip32Deriver(network);

      const result = deriver.createBip32FromSeed(pkBuffer);

      expect(result.chainCode).toBeDefined();
      expect(result.chainCode).not.toBeNull();
      expect(result.privateKey).toBeDefined();
      expect(result.privateKey).not.toBeNull();
      expect(result.publicKey).toBeDefined();
      expect(result.publicKey).not.toBeNull();
      expect(result.depth).toBeDefined();
      expect(result.depth).not.toBeNull();
      expect(result.index).toBeDefined();
      expect(result.index).not.toBeNull();
    });

    it('throws `Unable to construct BIP32 node from seed` if an error catched', () => {
      const network = networks.testnet;
      const seed = Buffer.from('', 'hex');

      const deriver = new BtcAccountBip32Deriver(network);

      expect(() => deriver.createBip32FromSeed(seed)).toThrow(
        'Unable to construct BIP32 node from seed',
      );
    });
  });

  describe('createBip32FromPrivateKey', () => {
    it('returns an BIP32Interface', async () => {
      const network = networks.testnet;
      const { deriver, pkBuffer, ccBuffer } = await prepareBip32Deriver(
        network,
      );

      const result = deriver.createBip32FromPrivateKey(pkBuffer, ccBuffer);

      expect(result.chainCode).toBeDefined();
      expect(result.chainCode).not.toBeNull();
      expect(result.privateKey).toBeDefined();
      expect(result.privateKey).not.toBeNull();
      expect(result.publicKey).toBeDefined();
      expect(result.publicKey).not.toBeNull();
      expect(result.depth).toBeDefined();
      expect(result.depth).not.toBeNull();
      expect(result.index).toBeDefined();
      expect(result.index).not.toBeNull();
    });

    it('throws `Unable to construct BIP32 node from private key` if an error catched', async () => {
      const network = networks.testnet;
      const deriver = new BtcAccountBip32Deriver(network);
      const pkBuffer = Buffer.from('');
      const ccBuffer = Buffer.from('');

      expect(() =>
        deriver.createBip32FromPrivateKey(pkBuffer, ccBuffer),
      ).toThrow('Unable to construct BIP32 node from private key');
    });
  });

  describe('getChild', () => {
    it('returns an BIP32Interface', async () => {
      const network = networks.testnet;
      const { deriver, pkBuffer, ccBuffer } = await prepareBip32Deriver(
        network,
      );

      const idx = 0;

      const node = deriver.createBip32FromPrivateKey(pkBuffer, ccBuffer);

      const result = await deriver.getChild(node, idx);

      expect(result.chainCode).toBeDefined();
      expect(result.chainCode).not.toBeNull();
      expect(result.privateKey).toBeDefined();
      expect(result.privateKey).not.toBeNull();
      expect(result.publicKey).toBeDefined();
      expect(result.publicKey).not.toBeNull();
      expect(result.depth).toBeDefined();
      expect(result.depth).not.toBeNull();
      expect(result.index).toBeDefined();
      expect(result.index).not.toBeNull();
    });
  });

  describe('getRoot', () => {
    it('returns an BIP32Interface', async () => {
      const network = networks.testnet;
      const { deriver, pkBuffer, ccBuffer } = await prepareBip32Deriver(
        network,
      );

      const result = await deriver.getRoot(P2WPKHAccount.path);

      expect(result.chainCode).toStrictEqual(ccBuffer);
      expect(result.privateKey).toStrictEqual(pkBuffer);
    });

    it('throws `Private key is invalid` if private key is invalid', async () => {
      const network = networks.testnet;
      const spy = jest.spyOn(strUtils, 'hexToBuffer');
      spy.mockImplementation(() => {
        throw new Error('error');
      });
      const { deriver } = await prepareBip32Deriver(network);

      await expect(deriver.getRoot(P2WPKHAccount.path)).rejects.toThrow(
        'Private key is invalid',
      );
    });

    it('throws `Chain code is invalid` if chain code is invalid', async () => {
      const network = networks.testnet;
      const spy = jest.spyOn(strUtils, 'hexToBuffer');
      spy
        .mockImplementationOnce((val: string) => Buffer.from(val, 'hex'))
        .mockImplementationOnce(() => {
          throw new Error('error');
        });
      const { deriver } = await prepareBip32Deriver(network);

      await expect(deriver.getRoot(P2WPKHAccount.path)).rejects.toThrow(
        'Chain code is invalid',
      );
    });

    it('throws DeriverError if private key is missing', async () => {
      const network = networks.testnet;
      const deriver = new BtcAccountBip32Deriver(network);

      jest
        .spyOn(SnapHelper, 'getBip32Deriver')
        .mockResolvedValue({} as unknown as SLIP10NodeInterface);

      await expect(deriver.getRoot(P2WPKHAccount.path)).rejects.toThrow(
        'Deriver private key is missing',
      );
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
      const { path } = P2WPKHAccount;
      const ecpair = ECPairFactory(ecc);
      const privateKey = ecpair.makeRandom().privateKey?.toString('hex');
      const { getBip44DeriverSpy, deriverSpy } = createMockBip44Entropy();

      deriverSpy.mockResolvedValue({
        privateKey,
      });

      const deriver = new BtcAccountBip44Deriver(network);
      await deriver.getRoot(path);

      expect(getBip44DeriverSpy).toHaveBeenCalledWith(0);
    });

    it('throws `Deriver private key is missing` error if the private key is missing', async () => {
      const network = networks.testnet;
      const { path } = P2WPKHAccount;
      const { deriverSpy } = createMockBip44Entropy();
      deriverSpy.mockResolvedValue({
        privateKey: undefined,
      });

      const deriver = new BtcAccountBip44Deriver(network);

      await expect(deriver.getRoot(path)).rejects.toThrow(
        'Deriver private key is missing',
      );
    });
  });
});
