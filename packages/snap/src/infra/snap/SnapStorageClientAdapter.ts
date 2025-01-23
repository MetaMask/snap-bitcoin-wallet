import type { SnapState, StorageClient } from '../../entities/snap';

export class SnapStorageClientAdapter implements StorageClient {
  readonly #encrypt: boolean;

  constructor(encrypt = false) {
    this.#encrypt = encrypt;
  }

  async get(): Promise<SnapState> {
    const state = await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'get',
        encrypted: this.#encrypt,
      },
    });

    return (
      (state as SnapState) ?? { accounts: { derivationPaths: {}, wallets: {} } }
    );
  }

  async update(newState: SnapState): Promise<void> {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState,
        encrypted: this.#encrypt,
      },
    });
  }
}
