import type { BIP32Interface } from 'bip32';
import type { HDSignerAsync } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

/**
 * An Signer object that defines methods and properties for signing transactions and verifying signatures in PSBT sign process.
 */
export class AccountSigner implements HDSignerAsync {
  /**
   * The public key of the current derived node used for verifying signatures, as a Buffer.
   */
  readonly publicKey: Buffer;

  /**
   * The fingerprint of the current derived node used for verifying signatures, as a Buffer.
   */
  readonly fingerprint: Buffer;

  protected readonly _node: BIP32Interface;

  constructor(accountNode: BIP32Interface, mfp?: Buffer) {
    this._node = accountNode;
    this.publicKey = this._node.publicKey;
    this.fingerprint = mfp ?? this._node.fingerprint;
  }

  /**
   * Derives a new `IAccountSigner` object using an HD path.
   *
   * @param path - The HD path in string format, e.g. `m'\0'\0`.
   * @returns A new `IAccountSigner` object derived by the given path.
   */
  derivePath(path: string): AccountSigner {
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

  /**
   * Signs a transaction hash.
   *
   * @param hash - The buffer containing the transaction hash to sign.
   * @returns A promise that resolves to the signed result as a Buffer.
   */
  async sign(hash: Buffer): Promise<Buffer> {
    return this._node.sign(hash);
  }

  /**
   * Verifies a signature using the derived node of an `IAccountSigner` object.
   *
   * @param hash - The buffer containing the transaction hash.
   * @param signature - The buffer containing the signature to verify.
   * @returns A boolean indicating whether the signature is valid.
   */
  verify(hash: Buffer, signature: Buffer): boolean {
    return this._node.verify(hash, signature);
  }
}
