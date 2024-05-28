import type { BIP44AddressKeyDeriver } from '@metamask/key-tree';
import {
  getBIP44AddressKeyDeriver,
  type SLIP10NodeInterface,
} from '@metamask/key-tree';
import type { Component, DialogResult, Json } from '@metamask/snaps-sdk';
import {
  heading,
  panel,
  text,
  divider,
  type SnapsProvider,
  row,
} from '@metamask/snaps-sdk';

declare const snap: SnapsProvider;

export class SnapHelper {
  static provider: SnapsProvider = snap;

  static async getBip44Deriver(
    coinType: number,
  ): Promise<BIP44AddressKeyDeriver> {
    const bip44Node = await SnapHelper.provider.request({
      method: 'snap_getBip44Entropy',
      params: {
        coinType,
      },
    });
    return getBIP44AddressKeyDeriver(bip44Node);
  }

  static async getBip32Deriver(
    path: string[],
    curve: 'secp256k1' | 'ed25519',
  ): Promise<SLIP10NodeInterface> {
    const node = await SnapHelper.provider.request({
      method: 'snap_getBip32Entropy',
      params: {
        path,
        curve,
      },
    });
    return node as SLIP10NodeInterface;
  }

  static async confirmDialog(
    header: string,
    subHeader: string,
    body: {
      label: string;
      value:
        | string
        | {
            label: string;
            value: string;
          }[];
    }[],
  ): Promise<DialogResult> {
    const components: Component[] = [
      heading(header),
      text(subHeader),
      divider(),
    ];

    for (const { label, value } of body) {
      if (typeof value === 'string') {
        components.push(row(label, text(value)));
      } else {
        components.push(text(`**${label}**:`));
        for (const { label: lb, value: val } of value) {
          components.push(row(lb, text(val)));
        }
      }
    }

    return SnapHelper.provider.request({
      method: 'snap_dialog',
      params: {
        type: 'confirmation',
        content: panel(components),
      },
    });
  }

  static async getStateData<State>(): Promise<State> {
    return (await SnapHelper.provider.request({
      method: 'snap_manageState',
      params: {
        operation: 'get',
      },
    })) as unknown as State;
  }

  static async setStateData<State>(data: State) {
    await SnapHelper.provider.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: data as unknown as Record<string, Json>,
      },
    });
  }
}
