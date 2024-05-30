import type { Json } from '@metamask/snaps-sdk';

import { Chain, Config } from '../../../config';
import type { IAmount } from '../../../wallet';
import { satsToBtc } from '../utils';

export class BtcAmount implements IAmount {
  #_value: number;

  constructor(value: number) {
    this.#_value = value;
  }

  public get value(): number {
    return this.#_value;
  }

  public set value(newValue: number) {
    this.#_value = newValue;
  }

  public valueOf(): number {
    return this.value;
  }

  public toString(withUnit = false): string {
    if (!withUnit) {
      return `${satsToBtc(this.value)}`;
    }
    return `${satsToBtc(this.value)} ${Config.unit[Chain.Bitcoin]}`;
  }

  public toJson(): Record<string, Json> {
    return {
      value: this.toString(true),
      rawValue: this.value,
    };
  }
}
