import ecc from '@bitcoinerlab/secp256k1';
import type { BIP32Interface, BIP32API } from 'bip32';
import { BIP32Factory } from 'bip32';
import { type Network } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';

import { SnapHelper } from '../../snap/helpers';
import { DeriverError } from './exceptions';
import { AddressHelper } from './helpers';
import type { IBtcAccountDeriver } from './types';

export abstract class BtcAccountDeriver implements IBtcAccountDeriver {
  protected readonly network: Network;

  protected readonly bip32Api: BIP32API;

  constructor(network: Network) {
    this.bip32Api = BIP32Factory(ecc);
    this.network = network;
  }

  abstract getRoot(path: string[]): Promise<BIP32Interface>;

  fromSeed(seed: Buffer): BIP32Interface {
    try {
      return this.bip32Api.fromSeed(seed, this.network);
    } catch (error) {
      throw new DeriverError('Unable to construct BIP32 node from seed');
    }
  }

  fromPrivateKey(privateKey: Buffer, chainNode: Buffer): BIP32Interface {
    try {
      return this.bip32Api.fromPrivateKey(privateKey, chainNode, this.network);
    } catch (error) {
      throw new DeriverError('Unable to construct BIP32 node from private key');
    }
  }

  async getChild(root: BIP32Interface, idx: number): Promise<BIP32Interface> {
    return Promise.resolve(root.deriveHardened(0).derive(0).derive(idx));
  }

  protected pkToBuf(pk: string): Buffer {
    try {
      return this.#toBuffer(pk);
    } catch (error) {
      throw new DeriverError('Private key is invalid');
    }
  }

  protected chainCodeToBuf(chainCode: string): Buffer {
    try {
      return this.#toBuffer(chainCode);
    } catch (error) {
      throw new DeriverError('Chain code is invalid');
    }
  }

  #toBuffer(val: string): Buffer {
    return Buffer.from(AddressHelper.trimHexPrefix(val), 'hex');
  }
}

export class BtcAccountBip44Deriver extends BtcAccountDeriver {
  async getRoot(path: string[]) {
    try {
      const deriver = await SnapHelper.getBip44Deriver(0); // seed phase
      const deriverNode = await deriver(0);
      if (!deriverNode.privateKey) {
        throw new DeriverError('Deriver private key is missing');
      }
      const privateKeyBuffer = this.pkToBuf(deriverNode.privateKey);
      const root = this.fromSeed(privateKeyBuffer);
      return root
        .deriveHardened(parseInt(path[1].slice(0, -1), 10))
        .deriveHardened(0);
    } catch (error) {
      throw new DeriverError(error);
    }
  }
}

export class BtcAccountBip32Deriver extends BtcAccountDeriver {
  readonly curve: 'secp256k1' | 'ed25519' = 'secp256k1';

  async getRoot(path: string[]) {
    try {
      const deriver = await SnapHelper.getBip32Deriver(path, this.curve);

      if (!deriver.privateKey) {
        throw new DeriverError('Deriver private key is missing');
      }

      const privateKeyBuffer = this.pkToBuf(deriver.privateKey);
      const chainCodeBuffer = this.chainCodeToBuf(deriver.chainCode);

      const root = this.fromPrivateKey(privateKeyBuffer, chainCodeBuffer);
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
      if (error instanceof DeriverError) {
        throw error;
      }
      throw new DeriverError(error);
    }
  }
}
