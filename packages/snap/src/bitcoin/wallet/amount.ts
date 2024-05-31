import type { Json } from '@metamask/snaps-sdk';

import { Chain, Config } from '../../config';
import type { IAmount } from '../../wallet';
import { satsToBtc } from '../utils';

export class BtcAmount implements IAmount {
  #_value: number;

  constructor(value: number) {
    this.#_value = value;
  }

  get value(): number {
    return this.#_value;
  }

  set value(newValue: number) {
    this.#_value = newValue;
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

  toJson(): Record<string, Json> {
    return {
      value: this.toString(true),
      unit: this.unit,
      rawValue: this.value,
    };
  }
}
