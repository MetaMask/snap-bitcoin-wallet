import type { Json } from '@metamask/snaps-sdk';
import type { Buffer } from 'buffer';

import type { TransactionIntent } from './chain';

export type ITransactionInfo = {
  /**
   * The transaction json.
   */
  toJson<TxnInfoJson extends Record<string, Json>>(): TxnInfoJson;
};

export type IAddress = {
  toString(isShortern?: boolean): string;
  explorerUrl: string;
};

export type IAmount = {
  value: number;
  toString(withUnit?: boolean): string;
};

export type IAccount = {
  /**
   * Master fingerpring of the devied node.
   */
  mfp: string;
  /**
   * Index of the devied node.
   */
  index: number;
  /**
   * Address of the account.
   */
  address: string;
  /**
   * HD path of the account.
   */
  hdPath: string;
  /**
   * Public key of the account.
   */
  pubkey: string;
  /**
   * Type of the account, e.g `bip122:p2pwh`.
   */
  type: string;
  /**
   * IAccountSigner object derived from the root node.
   */
  signer: IAccountSigner;
};

export type IWallet = {
  /**
   * A method to unlock an account by index and script type.
   *
   * @param index - Index to derive from the node.
   * @param type - Script type of the unlocked account, e.g `bip122:p2pkh`.
   * @returns A promise that resolves to an IAccount object.
   */
  unlock(index: number, type: string): Promise<IAccount>;

  /**
   * A method to sign an transaction by the given encoded txn string.
   *
   * @param signer - The signer object to sign the transaction.
   * @param txn - The encoded txn string to convert back to an transaction.
   * @returns A promise that resolves to an string of signed transaction.
   */
  signTransaction(signer: IAccountSigner, txn: string): Promise<string>;

  /**
   * A method to create an transaction by the given account, transaction intent and options.
   *
   * @param acount - The IAccount object to create the transaction.
   * @param txnIntent - The encoded txn string to convert back to an transaction.
   * @param options - The options to create the transaction.
   * @returns A promise that resolves to an object contains txnHash and txnJson.
   */
  createTransaction(
    acount: IAccount,
    txnIntent: TransactionIntent,
    options: Record<string, Json>,
  ): Promise<{
    txn: string;
    txnInfo: ITransactionInfo;
  }>;
};

export type IAccountSigner = {
  /**
   * A method to create an transaction by the given account, transaction intent and options.
   *
   * @param acount - The IAccount object to create the transaction.
   * @param txnIntent - The encoded txn string to convert back to an transaction.
   * @param options - The options to create the transaction.
   * @returns A promise that resolves to an object contains txnHash and txnJson.
   */
  sign(hash: Buffer): Promise<Buffer>;

  /**
   * A method to derive an IAccountSigner object by hd path.
   *
   * @param path - The hd path in string, e.g `m'\0'\0`.
   * @returns An IAccountSigner derived by the given path.
   */
  derivePath(path: string): IAccountSigner;

  /**
   * A method to veriy the signature by the derived node of an IAccountSigner object.
   *
   * @param hash - The hash of the transaction in buffer.
   * @param signature - The signature of the signed transaction in buffer.
   * @returns Verify result in Boolean.
   */
  verify(hash: Buffer, signature: Buffer): boolean;

  /**
   * Public Key of the current devied node for verify an signature.
   */
  publicKey: Buffer;

  /**
   * Fingerprint of the current devied node for verify an signature.
   */
  fingerprint: Buffer;
};
