import { replaceMiddleChar } from '../../utils';
import type { IAddress } from '../../wallet';

export class BtcAddress implements IAddress {
  value: string;

  constructor(address: string) {
    this.value = address;
  }

  valueOf(): string {
    return this.value;
  }

  toString(isShortern = false): string {
    return isShortern ? replaceMiddleChar(this.value, 5, 3) : this.value;
  }
}
