import type { BIP32Interface } from 'bip32';
import type { Network, Payment } from 'bitcoinjs-lib';

import type { IAccount, IAccountSigner } from '../../../wallet';
import type { ScriptType } from '../constants';

export type IBtcAccountDeriver = {
  getRoot(path: string[]): Promise<BIP32Interface>;
  getChild(root: BIP32Interface, idx: number): Promise<BIP32Interface>;
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

export type Utxo = {
  block: number;
  txnHash: string;
  index: number;
  value: number;
};
