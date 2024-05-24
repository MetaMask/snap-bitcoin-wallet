import type { Json } from '@metamask/snaps-sdk';
import type { Buffer } from 'buffer';

import type { TransactionIntent } from './chain';

export type IAccount = {
  mfp: string;
  index: number;
  address: string;
  hdPath: string;
  pubkey: string;
  type: string;
  signer: IAccountSigner;
};

export type IWallet = {
  unlock(index: number, type: string): Promise<IAccount>;
  signTransaction(signer: IAccountSigner, txn: string): Promise<string>;
  createTransaction(
    acount: IAccount,
    txn: TransactionIntent,
    options: Record<string, Json>,
  ): Promise<{
    txn: string;
    txnJson: Record<string, Json>;
  }>;
};

export type IAccountSigner = {
  sign(hash: Buffer): Promise<Buffer>;
  derivePath(path: string): IAccountSigner;
  verify(hash: Buffer, signature: Buffer): boolean;
  publicKey: Buffer;
  fingerprint: Buffer;
};
