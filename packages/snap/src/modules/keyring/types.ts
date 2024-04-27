import type { KeyringAccount } from '@metamask/keyring-api';
import { type Json } from '@metamask/snaps-sdk';
import type { Buffer } from 'buffer';
import type { Infer } from 'superstruct';
import { object } from 'superstruct';

import type { IStaticSnapRpcHandler } from '../../rpcs';
import { scopeStruct } from '../../utils';
import type { TransactionIntent } from '../chain';

export type Wallet = {
  account: KeyringAccount;
  type: string;
  index: number;
  scope: string;
};

export type Wallets = Record<string, Wallet>;

export type SnapState = {
  walletIds: string[];
  wallets: Wallets;
};

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
  signTransaction<Txn>(tx: Txn): Promise<string>;
  sign(message: Buffer): Promise<Buffer>;
};

export type IAccountMgr = {
  unlock(index: number): Promise<IAccount>;
  createTransaction(
    acount: IAccount,
    txn: TransactionIntent,
    options: {
      metadata: Record<string, Json>;
      fee: number;
    },
  ): Promise<{
    txn: Buffer;
    txnJson: Record<string, Json>;
  }>;
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
