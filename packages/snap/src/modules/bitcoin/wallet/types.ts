import type { BIP32Interface } from 'bip32';
import type { Network, Payment } from 'bitcoinjs-lib';

import type { Utxo } from '../../chain';
import type { IAccount, IAccountSigner } from '../../wallet';
import type { ScriptType } from '../constants';

export type IBtcAccountDeriver = {
  getRoot(path: string[]): Promise<BIP32Interface>;
  getChild(root: BIP32Interface, idx: number): Promise<BIP32Interface>;
};

export type IBtcAccount = IAccount & {
  payment: Payment;
  scriptType: ScriptType;
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

export type SpendTo = {
  address: string;
  value: number;
};

export type SelectedOutput = {
  address?: string;
  value: number;
};

export type SelectedUtxos = {
  inputs: Utxo[];
  outputs: SelectedOutput[];
  fee: number;
};
