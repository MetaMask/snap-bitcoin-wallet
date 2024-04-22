import { type Json } from '@metamask/snaps-sdk';
import type { Buffer } from 'buffer';

export type IAccountSigner = {
  sign(hash: Buffer): Promise<Buffer>;
  derivePath(path: string): IAccountSigner;
  verify(hash: Buffer, signature: Buffer): boolean;
  publicKey: Buffer;
  fingerprint: Buffer;
};

export type IAccount = {
  mfp: string;
  index: number;
  address: string;
  hdPath: string;
  pubkey: string;
  type: string;
  signer: IAccountSigner;
};

export type IAccountMgr = {
  unlock(index: number): Promise<IAccount>;
};

export type KeyringOptions = Record<string, Json> & {
  defaultIndex: number;
  multiAccount?: boolean;
  emitEvents?: boolean;
};
