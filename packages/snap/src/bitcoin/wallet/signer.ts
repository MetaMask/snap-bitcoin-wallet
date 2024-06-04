import type { BIP32Interface } from 'bip32';
import type { HDSignerAsync } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import type { IAccountSigner } from '../../wallet';

export class AccountSigner implements HDSignerAsync, IAccountSigner {
  readonly publicKey: Buffer;

  readonly fingerprint: Buffer;

  protected readonly _node: BIP32Interface;

  constructor(accountNode: BIP32Interface, mfp?: Buffer) {
    this._node = accountNode;
    this.publicKey = this._node.publicKey;
    this.fingerprint = mfp ?? this._node.fingerprint;
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
      }, this._node);
      return new AccountSigner(childNode, this.fingerprint);
    } catch (error) {
      throw new Error('Unable to derive path');
    }
  }

  async sign(hash: Buffer): Promise<Buffer> {
    return this._node.sign(hash);
  }

  verify(hash: Buffer, signature: Buffer): boolean {
    return this._node.verify(hash, signature);
  }
}
