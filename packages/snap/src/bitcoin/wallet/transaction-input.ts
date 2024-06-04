import type { Buffer } from 'buffer';

import type { IAmount } from '../../wallet';
import { BtcAmount } from './amount';
import type { Utxo } from './types';

export class TxInput {
  // consume by coinselect
  readonly script: Buffer;

  readonly amount: IAmount;

  readonly utxo: Utxo;

  constructor(utxo: Utxo, script: Buffer) {
    this.script = script;
    this.utxo = utxo;
    this.amount = new BtcAmount(utxo.value);
  }

  // consume by coinselect
  get value(): number {
    return this.amount.value;
  }

  get txHash(): string {
    return this.utxo.txHash;
  }

  get index(): number {
    return this.utxo.index;
  }

  get block(): number {
    return this.utxo.block;
  }
}
