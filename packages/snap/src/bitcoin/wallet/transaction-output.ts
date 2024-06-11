import type { Buffer } from 'buffer';

export class TxOutput {
  protected _value: bigint;

  // consume by conselect
  readonly script: Buffer;

  readonly address: string;

  constructor(value: bigint | number, address: string, script: Buffer) {
    this.value = value;
    this.address = address;
    this.script = script;
  }

  // consume by conselect
  get value(): number {
    return Number(this._value);
  }

  set value(value: bigint | number) {
    if (typeof value === 'number') {
      this._value = BigInt(value);
    } else {
      this._value = value;
    }
  }

  get bigIntValue(): bigint {
    return this._value;
  }
}
