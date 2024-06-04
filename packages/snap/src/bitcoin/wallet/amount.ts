import { Chain, Config } from '../../config';
import type { IAmount } from '../../wallet';
import { satsToBtc } from '../utils';

export class BtcAmount implements IAmount {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  get unit(): string {
    return Config.unit[Chain.Bitcoin];
  }

  valueOf(): number {
    return this.value;
  }

  toString(withUnit = false): string {
    if (!withUnit) {
      return `${satsToBtc(this.value)}`;
    }
    return `${satsToBtc(this.value)} ${this.unit}`;
  }
}
