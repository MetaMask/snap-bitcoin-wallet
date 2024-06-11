//  CHECK - remove (?)
import { Config } from '../../config';
import type { IAmount } from '../../wallet';
import { satsToBtc } from '../utils';

export class BtcAmount implements IAmount {
  _value: bigint;

  constructor(value: bigint | number) {
    if (typeof value === 'number') {
      this._value = BigInt(value);
    } else {
      this._value = value;
    }
  }

  set value(value: bigint) {
    this._value = value;
  }

  get value(): bigint {
    return this._value;
  }

  get unit(): string {
    return Config.unit;
  }

  toString(withUnit = false): string {
    if (!withUnit) {
      return `${satsToBtc(this.value)}`;
    }
    return `${satsToBtc(this.value)} ${this.unit}`;
  }
}
