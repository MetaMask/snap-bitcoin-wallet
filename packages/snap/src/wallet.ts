import type { Json } from '@metamask/snaps-sdk';
import type { Buffer } from 'buffer';

export type Recipient = {
  address: string;
  value: number;
};

export type Transaction = {
  tx: string;
  txInfo: ITxInfo;
};

/**
 * An interface that defines a `toJson` method for getting a JSON representation of a transaction info object.
 */
export type ITxInfo = {
  /**
   * Returns a JSON representation of the transaction info object.
   *
   * @returns The JSON representation of the transaction info object.
   */
  toJson<TxInfoJson extends Record<string, Json>>(): TxInfoJson;
};

/**
 * An interface that defines methods and properties for working with blockchain addresses.
 */
export type IAddress = {
  /**
   * The string value of the address.
   */
  value: string;

  /**
   * Returns the string representation of the address.
   *
   * @param isShorten - A boolean indicating whether the address should be shortened.
   * @returns The string representation of the address.
   */
  toString(isShorten?: boolean): string;
};

/**
 * An interface that defines properties for working with amounts of cryptocurrency.
 */
export type IAmount = {
  /**
   * The numeric value of the amount.
   */
  value: number;

  /**
   * The unit of the amount, e.g. "BTC" or "ETH".
   */
  unit: string;

  /**
   * Returns the string representation of the amount, with or without the unit.
   *
   * @param withUnit - A boolean indicating whether to include the unit in the string representation.
   * @returns The string representation of the amount.
   */
  toString(withUnit?: boolean): string;
};

/**
 * An interface that defines properties for an account, including its address, HD path, public key, and signer object.
 */
export type IAccount = {
  /**
   * The master fingerprint of the derived node, as a string.
   */
  mfp: string;
  /**
   * The index of the derived node, as a number.
   */
  index: number;
  /**
   * The address of the account, as a string.
   */
  address: string;
  /**
   * The HD path of the account, as a string.
   */
  hdPath: string;
  /**
   * The public key of the account, as a string.
   */
  pubkey: string;
  /**
   * The type of the account, e.g. `bip122:p2pwh`, as a string.
   */
  type: string;
  /**
   * The `IAccountSigner` object derived from the root node.
   */
  signer: IAccountSigner;
};

/**
 * An interface that defines methods for unlocking accounts, signing transactions, and creating transactions.
 */
export type IWallet = {
  /**
   * Unlocks an account by index and script type.
   *
   * @param index - The index to derive from the node.
   * @param type - The script type of the unlocked account, e.g. `bip122:p2pkh`.
   * @returns A promise that resolves to an `IAccount` object.
   */
  unlock(index: number, type: string): Promise<IAccount>;

  /**
   * Signs a transaction by the given encoded transaction string.
   *
   * @param signer - The `IAccountSigner` object to sign the transaction.
   * @param transaction - The encoded transaction string to convert back to a transaction.
   * @returns A promise that resolves to a string of the signed transaction.
   */
  signTransaction(signer: IAccountSigner, transaction: string): Promise<string>;

  /**
   * Creates a transaction using the given account, transaction intent, and options.
   *
   * @param account - The `IAccount` object to create the transaction.
   * @param recipients - The transaction recipients.
   * @param options - The options to use when creating the transaction.
   * @returns A promise that resolves to an object containing the transaction hash and transaction info.
   */
  createTransaction(
    account: IAccount,
    recipients: Recipient[],
    options: Record<string, Json>,
  ): Promise<Transaction>;
};

/**
 * An interface that defines methods and properties for signing transactions and verifying signatures.
 */
export type IAccountSigner = {
  /**
   * Signs a transaction hash.
   *
   * @param hash - The buffer containing the transaction hash to sign.
   * @returns A promise that resolves to the signed result as a Buffer.
   */
  sign(hash: Buffer): Promise<Buffer>;

  /**
   * Derives a new `IAccountSigner` object using an HD path.
   *
   * @param path - The HD path in string format, e.g. `m'\0'\0`.
   * @returns A new `IAccountSigner` object derived by the given path.
   */
  derivePath(path: string): IAccountSigner;

  /**
   * Verifies a signature using the derived node of an `IAccountSigner` object.
   *
   * @param hash - The buffer containing the transaction hash.
   * @param signature - The buffer containing the signature to verify.
   * @returns A boolean indicating whether the signature is valid.
   */
  verify(hash: Buffer, signature: Buffer): boolean;

  /**
   * The public key of the current derived node used for verifying signatures, as a Buffer.
   */
  publicKey: Buffer;

  /**
   * The fingerprint of the current derived node used for verifying signatures, as a Buffer.
   */
  fingerprint: Buffer;
};
