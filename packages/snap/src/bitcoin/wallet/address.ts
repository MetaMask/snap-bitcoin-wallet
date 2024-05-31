import type { Json } from '@metamask/snaps-sdk';
import type { Network } from 'bitcoinjs-lib';

import { replaceMiddleChar } from '../../utils';
import type { IAddress } from '../../wallet';
import { getCaip2Network, getExplorerUrl } from '../utils';

export class BtcAddress implements IAddress {
  address: string;

  network: Network;

  constructor(address: string, network: Network) {
    this.address = address;
    this.network = network;
  }

  get explorerUrl(): string {
    return getExplorerUrl(this.address, getCaip2Network(this.network));
  }

  valueOf(): string {
    return this.address;
  }

  toString(isShortern = false): string {
    return isShortern ? replaceMiddleChar(this.address, 5, 3) : this.address;
  }

  toJson(): Record<string, Json> {
    return {
      address: this.toString(true),
      rawAddress: this.address,
      explorerUrl: this.explorerUrl,
    };
  }
}
