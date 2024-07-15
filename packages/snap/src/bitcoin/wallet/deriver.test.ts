import { type SLIP10NodeInterface } from '@metamask/key-tree';
import { networks } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import * as snapUtils from '../../utils/snap';
import * as strUtils from '../../utils/string';
import { P2WPKHAccount } from './account';
import { BtcAccountDeriver } from './deriver';

jest.mock('../../utils/snap');

describe('BtcAccountDeriver', () => {
  const prepareBip32Deriver = async (network) => {
    const deriver = new BtcAccountDeriver(network);
    const bip32Deriver = await snapUtils.getBip32Deriver(
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

    it('throws `Unable to construct BIP32 node from private key` if another error was thrown', async () => {
      const network = networks.testnet;
      const deriver = new BtcAccountDeriver(network);
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

      const hdPath = [`m`, `0'`, `0`, `0`];

      const node = deriver.createBip32FromPrivateKey(pkBuffer, ccBuffer);

      const result = await deriver.getChild(node, hdPath);

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

    it.each(["m/1''/0/0", "m/-1'/0/0", "m/0'/-1/0", "m/0'/1a/0"])(
      'throws `Invalid index` if hdPath is invalid: %s',
      async (path: string) => {
        const network = networks.testnet;
        const { deriver, pkBuffer, ccBuffer } = await prepareBip32Deriver(
          network,
        );
        const node = deriver.createBip32FromPrivateKey(pkBuffer, ccBuffer);
        await expect(deriver.getChild(node, path.split('/'))).rejects.toThrow(
          'Invalid index',
        );
      },
    );
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

    it('throws error if private key is invalid', async () => {
      const network = networks.testnet;
      const spy = jest.spyOn(strUtils, 'hexToBuffer');
      spy.mockImplementation(() => {
        throw new Error('error');
      });
      const { deriver } = await prepareBip32Deriver(network);

      await expect(deriver.getRoot(P2WPKHAccount.path)).rejects.toThrow(
        'error',
      );
    });

    it('throws error if chain code is invalid', async () => {
      const network = networks.testnet;
      const spy = jest.spyOn(strUtils, 'hexToBuffer');
      spy
        .mockImplementationOnce((val: string) => Buffer.from(val, 'hex'))
        .mockImplementationOnce(() => {
          throw new Error('error');
        });
      const { deriver } = await prepareBip32Deriver(network);

      await expect(deriver.getRoot(P2WPKHAccount.path)).rejects.toThrow(
        'error',
      );
    });

    it('throws DeriverError if private key is missing', async () => {
      const network = networks.testnet;
      const deriver = new BtcAccountDeriver(network);

      jest
        .spyOn(snapUtils, 'getBip32Deriver')
        .mockResolvedValue({} as unknown as SLIP10NodeInterface);

      await expect(deriver.getRoot(P2WPKHAccount.path)).rejects.toThrow(
        'Deriver private key is missing',
      );
    });
  });
});
