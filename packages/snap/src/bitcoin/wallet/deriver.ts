import ecc from '@bitcoinerlab/secp256k1';
import type { BIP32Interface, BIP32API } from 'bip32';
import { BIP32Factory } from 'bip32';
import { type Network } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import { compactError, hexToBuffer, getBip32Deriver } from '../../utils';
import { DeriverError } from './exceptions';
import { deriveByPath } from './utils/deriver';
import { SupportedCurve } from '@metamask/key-tree';

/**
 * This class provides a mechanism for deriving Bitcoin accounts using BIP32.
 */
export class BtcAccountDeriver {
  protected readonly _network: Network;

  protected readonly _bip32Api: BIP32API;

  /**
   * The curve to use for account derivation. Defaults to 'secp256k1'.
   */
  readonly curve: SupportedCurve = 'secp256k1';

  constructor(network: Network) {
    this._bip32Api = BIP32Factory(ecc);
    this._network = network;
  }

  /**
   * Gets the root node of a BIP32 account given a path.
   *
   * @param path - The BIP32 path to use for derivation.
   * @returns The root node of the BIP32 account.
   * @throws {DeriverError} Throws a DeriverError if the private key is missing or if the BIP32 node cannot be constructed from the private key.
   */
  async getRoot(path: string[]): Promise<BIP32Interface> {
    try {
      const deriver = await getBip32Deriver(path, this.curve);

      if (!deriver.privateKey) {
        throw new DeriverError('Deriver private key is missing');
      }

      const privateKeyBuffer = hexToBuffer(deriver.privateKey);
      const chainCodeBuffer = hexToBuffer(deriver.chainCode);

      const root = this.createBip32FromPrivateKey(
        privateKeyBuffer,
        chainCodeBuffer,
      );

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // ignore checking since no function to set depth for node
      root.__DEPTH = deriver.depth;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // ignore checking since no function to set index for node
      root.__INDEX = deriver.index;

      return root;
    } catch (error) {
      throw compactError(error, DeriverError);
    }
  }

  /**
   * Creates a BIP32 node from a private key and chain node.
   *
   * @param privateKey - The private key buffer.
   * @param chainNode - The chain node buffer.
   * @returns The BIP32 node.
   * @throws {DeriverError} Throws a DeriverError if the BIP32 node cannot be constructed from the private key.
   */
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

  /**
   * Gets a child node of a BIP32 account given an index.
   *
   * @param root - The root node of the BIP32 account.
   * @param hdPath - The HD path to derive.
   * @returns A promise that resolves to the child node.
   */
  async getChild(
    root: BIP32Interface,
    hdPath: string[],
  ): Promise<BIP32Interface> {
    return Promise.resolve(deriveByPath(root, hdPath));
  }
}
