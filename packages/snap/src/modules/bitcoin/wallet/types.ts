import type { BIP32Interface } from 'bip32';
import type { Network, Payment } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';

import type { IAccount } from '../../wallet';
import type { ScriptType } from '../constants';

export type IBtcAccountDeriver = {
  getRoot(path: string[]): Promise<BIP32Interface>;
  getChild(root: BIP32Interface, idx: number): Promise<BIP32Interface>;
};

export type IAccountSigner = {
  sign(hash: Buffer): Promise<Buffer>;
  derivePath(path: string): IAccountSigner;
  verify(hash: Buffer, signature: Buffer): boolean;
  publicKey: Buffer;
  fingerprint: Buffer;
};

export type IBtcAccount = IAccount & {
  payment: Payment;
};

export type IStaticBtcAccount = {
  path: string[];
  scriptType: ScriptType;
  new (
    mfp: string,
    index: number,
    hdPath: string,
    pubkey: string,
    network: Network,
    scriptType: ScriptType,
    type: string,
    signer: IAccountSigner,
  ): IBtcAccount;
};
