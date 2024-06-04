import { Buffer } from 'buffer';

import { bufferToString } from '../../utils';
import type { IAddress, IAmount } from '../../wallet';
import { BtcAddress } from './address';
import { BtcAmount } from './amount';

export class TxOutput {
  amount: IAmount;

  scriptBuf: Buffer;

  // consume by conselect
  script: string;

  destination: IAddress;

  constructor(value: number, address: string, script?: Buffer) {
    this.amount = new BtcAmount(value);
    this.destination = new BtcAddress(address);
    this.scriptBuf = script ?? Buffer.alloc(0);
    this.script = bufferToString(this.scriptBuf, 'hex');
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
