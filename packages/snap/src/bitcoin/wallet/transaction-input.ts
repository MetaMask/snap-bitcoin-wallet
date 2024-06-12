import type { Buffer } from 'buffer';

import type { Utxo } from '../chain';

export class TxInput {
  protected _value: bigint;

  // consume by coinselect
  readonly script: Buffer;

  readonly txHash: string;

  readonly index: number;

  readonly block: number;

  constructor(utxo: Utxo, script: Buffer) {
    this.script = script;
    this._value = BigInt(utxo.value);
    this.index = utxo.index;
    this.txHash = utxo.txHash;
    this.block = utxo.block;
  }

  // consume by coinselect
  get value(): number {
    return Number(this._value);
  }

  get bigIntValue(): bigint {
    return this._value;
  }
}
