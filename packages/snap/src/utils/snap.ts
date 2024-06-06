import {
  getBIP44AddressKeyDeriver,
  type BIP44AddressKeyDeriver,
  type SLIP10NodeInterface,
} from '@metamask/key-tree';
import type { Component, DialogResult, Json } from '@metamask/snaps-sdk';
import { panel, type SnapsProvider } from '@metamask/snaps-sdk';

declare const snap: SnapsProvider;

/**
 * Retrieves the current SnapsProvider.
 *
 * @returns The current SnapsProvider.
 */
export function getProvider(): SnapsProvider {
  return snap;
}

/**
 * Retrieves a BIP44AddressKeyDeriver for the specified coin type.
 *
 * @param coinType - The coin type for which to retrieve a BIP44AddressKeyDeriver.
 * @returns A Promise that resolves to a BIP44AddressKeyDeriver object.
 */
export async function getBip44Deriver(
  coinType: number,
): Promise<BIP44AddressKeyDeriver> {
  const bip44Node = await snap.request({
    method: 'snap_getBip44Entropy',
    params: {
      coinType,
    },
  });
  return getBIP44AddressKeyDeriver(bip44Node);
}

/**
 * Retrieves a SLIP10NodeInterface object for the specified path and curve.
 *
 * @param path - The BIP32 derivation path for which to retrieve a SLIP10NodeInterface.
 * @param curve - The elliptic curve to use for key derivation.
 * @returns A Promise that resolves to a SLIP10NodeInterface object.
 */
export async function getBip32Deriver(
  path: string[],
  curve: 'secp256k1' | 'ed25519',
): Promise<SLIP10NodeInterface> {
  const node = await snap.request({
    method: 'snap_getBip32Entropy',
    params: {
      path,
      curve,
    },
  });
  return node as SLIP10NodeInterface;
}

/**
 * Displays a confirmation dialog with the specified components.
 *
 * @param components - An array of components to display in the dialog.
 * @returns A Promise that resolves to the result of the dialog.
 */
export async function confirmDialog(
  components: Component[],
): Promise<DialogResult> {
  return snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel(components),
    },
  });
}

/**
 * Retrieves the current state data.
 *
 * @returns A Promise that resolves to the current state data.
 */
export async function getStateData<State>(): Promise<State> {
  return (await snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'get',
    },
  })) as unknown as State;
}

/**
 * Sets the current state data to the specified data.
 *
 * @param data - The new state data to set.
 */
export async function setStateData<State>(data: State) {
  await snap.request({
    method: 'snap_manageState',
    params: {
      operation: 'update',
      newState: data as unknown as Record<string, Json>,
    },
  });
}
