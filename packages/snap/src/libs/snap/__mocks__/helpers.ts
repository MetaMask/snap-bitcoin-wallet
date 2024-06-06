import { type SLIP10NodeInterface } from '@metamask/key-tree';
import { networks } from 'bitcoinjs-lib';

import { createRandomBip32Data } from '../../../../test/utils';

export class SnapHelper {
  static getBip44Deriver = jest.fn();

  static async getBip32Deriver(
    path: string[],
    curve: 'secp256k1' | 'ed25519',
  ): Promise<SLIP10NodeInterface> {
    const { data } = createRandomBip32Data(networks.bitcoin, path, curve);
    return {
      ...data,
      toJSON: jest.fn().mockReturnValue(data),
    } as SLIP10NodeInterface;
  }

  static confirmDialog = jest.fn();

  static getStateData = jest.fn();

  static setStateData = jest.fn();
}
