import type { BIP32Interface } from 'bip32';
import type { Network, Payment } from 'bitcoinjs-lib';

import type { IAccount, IAccountSigner } from '../../wallet';
import type { ScriptType } from '../constants';
import type { TxInput } from './transaction-input';
import type { TxOutput } from './transaction-output';

export type IBtcAccountDeriver = {
  getRoot(path: string[]): Promise<BIP32Interface>;
  getChild(root: BIP32Interface, idx: number): Promise<BIP32Interface>;
};

export type IBtcAccount = IAccount & {
  payment: Payment;
  scriptType: ScriptType;
  network: Network;
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

export type CreateTransactionOptions = {
  utxos: Utxo[];
  fee: number;
  subtractFeeFrom: string[];
  //
  // BIP125 opt-in RBF flag,
  //
  replaceable: boolean;
};

export type Utxo = {
  block: number;
  txHash: string;
  index: number;
  value: number;
};

export type SelectionResult = {
  change?: TxOutput;
  fee: number;
  inputs: TxInput[];
  outputs: TxOutput[];
};
