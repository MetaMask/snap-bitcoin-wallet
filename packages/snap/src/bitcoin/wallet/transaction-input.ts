import type { Buffer } from 'buffer';

import type { IAmount } from '../../wallet';
import { BtcAmount } from './amount';
import type { Utxo } from './types';

export class TxInput {
  // consume by coinselect
  readonly script: Buffer;

  readonly amount: IAmount;

  readonly txHash: string;

  readonly index: number;

  readonly block: number;

  constructor(utxo: Utxo, script: Buffer) {
    this.script = script;
    this.amount = new BtcAmount(utxo.value);
    this.index = utxo.index;
    this.txHash = utxo.txHash;
    this.block = utxo.block;
  }

  // consume by coinselect
  get value(): number {
    return this.amount.value;
  }
}
