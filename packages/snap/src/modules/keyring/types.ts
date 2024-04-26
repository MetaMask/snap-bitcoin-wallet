import { type Json } from '@metamask/snaps-sdk';
import type { Buffer } from 'buffer';
import type { Infer } from 'superstruct';
import { object } from 'superstruct';

import type { IStaticSnapRpcHandler } from '../../rpcs';
import { scopeStruct } from '../../utils';

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
  // TODO: Temp solutio to support keyring in snap without keyring API
  emitEvents?: boolean;
};

export type ChainRPCHandlers = Record<string, IStaticSnapRpcHandler>;

export const CreateAccountOptionsStruct = object({
  scope: scopeStruct,
});

export type CreateAccountOptions = Record<string, Json> &
  Infer<typeof CreateAccountOptionsStruct>;
