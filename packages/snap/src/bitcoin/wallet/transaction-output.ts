//  CHECK - simplify
import type { Buffer } from 'buffer';

import type { IAddress, IAmount } from '../../wallet';
import { BtcAddress } from './address';
import { BtcAmount } from './amount';

export class TxOutput {
  readonly amount: IAmount;

  // consume by conselect
  readonly script: Buffer;

  readonly destination: IAddress;

  protected _value: bigint;

  constructor(value: bigint | number, address: string, script: Buffer) {
    this.amount = new BtcAmount(value);
    this.destination = new BtcAddress(address);
    this.script = script;
  }

  // consume by conselect
  get value(): number {
    return Number(this.amount.value);
  }

  set value(value: bigint | number) {
    if (typeof value === 'number') {
      this.amount.value = BigInt(value);
    } else {
      this.amount.value = value;
    }
  }

  get address(): string {
    return this.destination.value;
  }
}
