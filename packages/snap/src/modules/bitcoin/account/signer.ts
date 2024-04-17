import type { BIP32Interface } from 'bip32';
import type { HDSignerAsync } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import type { IAccountSigner } from './types';

export class AccountSigner implements HDSignerAsync, IAccountSigner {
  readonly publicKey: Buffer;

  readonly fingerprint: Buffer;

  protected readonly node: BIP32Interface;

  constructor(accountNode: BIP32Interface, mfp?: Buffer) {
    this.node = accountNode;
    this.publicKey = this.node.publicKey;
    this.fingerprint = mfp ?? this.node.fingerprint;
  }

  derivePath(path: string): IAccountSigner {
    try {
      let splitPath = path.split('/');
      if (splitPath[0] === 'm') {
        splitPath = splitPath.slice(1);
      }
      const childNode = splitPath.reduce((prevHd, indexStr) => {
        let index;
        if (indexStr.endsWith(`'`)) {
          index = parseInt(indexStr.slice(0, -1), 10);
          return prevHd.deriveHardened(index);
        }
        index = parseInt(indexStr, 10);
        return prevHd.derive(index);
      }, this.node);
      return new AccountSigner(childNode, this.fingerprint);
    } catch (error) {
      throw new Error('invalid path');
    }
  }

  async sign(hash: Buffer): Promise<Buffer> {
    return this.node.sign(hash);
  }

  verify(hash: Buffer, signature: Buffer): boolean {
    return this.node.verify(hash, signature);
  }
}
