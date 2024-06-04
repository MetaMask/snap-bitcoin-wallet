import type { IAddress, IAmount } from '../../wallet';
import { BtcAddress } from './address';
import { BtcAmount } from './amount';

export class TxOutput {
  amount: IAmount;

  destination: IAddress;

  constructor(value: number, address: string) {
    this.amount = new BtcAmount(value);
    this.destination = new BtcAddress(address);
  }

  get value(): number {
    return this.amount.value;
  }

  get address(): string {
    return this.destination.value;
  }
}
