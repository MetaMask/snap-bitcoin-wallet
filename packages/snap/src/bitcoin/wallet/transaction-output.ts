import type { Buffer } from 'buffer';

import type { IAddress, IAmount } from '../../wallet';
import { BtcAddress } from './address';
import { BtcAmount } from './amount';

export class TxOutput {
  readonly amount: IAmount;

  // consume by conselect
  readonly script: Buffer;

  readonly destination: IAddress;

  constructor(value: number, address: string, script: Buffer) {
    this.amount = new BtcAmount(value);
    this.destination = new BtcAddress(address);
    this.script = script;
  }

  // consume by conselect
  get value(): number {
    return this.amount.value;
  }

  set value(value: number) {
    this.amount.value = value;
  }

  get address(): string {
    return this.destination.value;
  }
}
