import { type SLIP10NodeInterface } from '@metamask/key-tree';
import type {
  Component,
  DialogResult,
  GetCurrencyRateResult,
  Json,
} from '@metamask/snaps-sdk';
import { DialogType, panel, type SnapsProvider } from '@metamask/snaps-sdk';

import type { Caip2Asset } from '../constants';

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
      type: DialogType.Confirmation,
      content: panel(components),
    },
  });
}

/**
 * Displays a alert dialog with the specified components.
 *
 * @param components - An array of components to display in the dialog.
 * @returns A Promise that resolves to the result of the dialog.
 */
export async function alertDialog(
  components: Component[],
): Promise<DialogResult> {
  return snap.request({
    method: 'snap_dialog',
    params: {
      type: DialogType.Alert,
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

/**
 * Creates and sends a UI dialog with the specified interface ID.
 *
 * @param interfaceId - The ID of the interface to create the dialog for.
 * @returns A Promise that resolves to the result of the dialog request.
 */
export async function createSendUIDialog(interfaceId: string) {
  return await snap.request({
    method: 'snap_dialog',
    params: {
      id: interfaceId,
    },
  });
}

/**
 * Retrieves the currency rates from MetaMask for the specified asset.
 *
 * @param _asset - The asset for which to retrieve the currency rates.
 * @returns A Promise that resolves to the currency rates.
 */
export async function getRatesFromMetamask(
  _asset: Caip2Asset,
): Promise<GetCurrencyRateResult> {
  // _asset is not used because the only supported asset is 'btc' for now.

  return (await snap.request({
    // @ts-expect-error TODO: snaps will fix this type error
    method: 'snap_getCurrencyRate',
    params: {
      // @ts-expect-error TODO: snaps will fix this type error
      currency: 'btc',
    },
  })) as GetCurrencyRateResult;
}
