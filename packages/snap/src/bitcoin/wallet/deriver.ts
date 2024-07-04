import ecc from '@bitcoinerlab/secp256k1';
import type { BIP32Interface, BIP32API } from 'bip32';
import { BIP32Factory } from 'bip32';
import { type Network } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import { compactError, hexToBuffer, getBip32Deriver } from '../../utils';
import { DeriverError } from './exceptions';

export class BtcAccountDeriver {
  protected readonly _network: Network;

  protected readonly _bip32Api: BIP32API;

  readonly curve: 'secp256k1' | 'ed25519' = 'secp256k1';

  constructor(network: Network) {
    this._bip32Api = BIP32Factory(ecc);
    this._network = network;
  }

  async getRoot(path: string[]) {
    try {
      const deriver = await getBip32Deriver(path, this.curve);

      if (!deriver.privateKey) {
        throw new DeriverError('Deriver private key is missing');
      }

      const privateKeyBuffer = this.pkToBuf(deriver.privateKey);
      const chainCodeBuffer = this.chainCodeToBuf(deriver.chainCode);

      const root = this.createBip32FromPrivateKey(
        privateKeyBuffer,
        chainCodeBuffer,
      );
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // ignore checking since no function to set depth for node
      root.DEPTH = deriver.depth;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // ignore checking since no function to set index for node
      root.INDEX = deriver.index;

      return root;
    } catch (error) {
      throw compactError(error, DeriverError);
    }
  }

  createBip32FromPrivateKey(
    privateKey: Buffer,
    chainNode: Buffer,
  ): BIP32Interface {
    try {
      return this._bip32Api.fromPrivateKey(
        privateKey,
        chainNode,
        this._network,
      );
    } catch (error) {
      throw new DeriverError('Unable to construct BIP32 node from private key');
    }
  }

  async getChild(root: BIP32Interface, idx: number): Promise<BIP32Interface> {
    return Promise.resolve(root.deriveHardened(0).derive(0).derive(idx));
  }

  protected pkToBuf(pk: string): Buffer {
    try {
      return hexToBuffer(pk);
    } catch (error) {
      throw new DeriverError('Private key is invalid');
    }
  }

  protected chainCodeToBuf(chainCode: string): Buffer {
    try {
      return hexToBuffer(chainCode);
    } catch (error) {
      throw new DeriverError('Chain code is invalid');
    }
  }
}
