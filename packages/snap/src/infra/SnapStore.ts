import { JsonSLIP10Node } from '@metamask/key-tree';

export type State = {
  accounts: {
    derivationPaths: Record<string, string>;
    wallets: Record<string, string>;
  };
};

export class SnapStore {
  protected readonly _encrypt: boolean;

  constructor(encrypt = false) {
    this._encrypt = encrypt;
  }

  async get(): Promise<State> {
    const state = await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'get',
        encrypted: this._encrypt,
      },
    });

    return (
      (state as State) ?? { accounts: { derivationPaths: {}, wallets: {} } }
    );
  }

  async set(newState: State): Promise<void> {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState,
        encrypted: this._encrypt,
      },
    });
  }

  async getSLIP10(derivationPath: string[]): Promise<JsonSLIP10Node> {
    return await snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path: derivationPath,
        curve: 'secp256k1',
      },
    });
  }
}
