import { type SLIP10NodeInterface } from '@metamask/key-tree';
import { networks } from 'bitcoinjs-lib';

import { createRandomBip32Data } from '../../../test/utils';

export const getProvider = jest.fn();

/**
 * Retrieves a `SLIP10NodeInterface` object for the specified path and curve.
 *
 * @param path - The BIP32 derivation path for which to retrieve a `SLIP10NodeInterface`.
 * @param curve - The elliptic curve to use for key derivation.
 * @returns A Promise that resolves to a `SLIP10NodeInterface` object.
 */
export async function getBip32Deriver(
  path: string[],
  curve: 'secp256k1' | 'ed25519',
): Promise<SLIP10NodeInterface> {
  const { data } = createRandomBip32Data(networks.bitcoin, path, curve);
  return {
    ...data,
    toJSON: jest.fn().mockReturnValue(data),
  } as SLIP10NodeInterface;
}

export const getBip44Deriver = jest.fn();

export const confirmDialog = jest.fn();

export const alertDialog = jest.fn();

export const getStateData = jest.fn();

export const setStateData = jest.fn();
