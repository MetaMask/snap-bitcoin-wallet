import type { JsonSLIP10Node } from '@metamask/key-tree';
import { SLIP10Node } from '@metamask/key-tree';

export type State = {
  accounts: {
    derivationPaths: Record<string, string>;
    wallets: Record<string, string>;
  };
};

/**
 * The SnapStore class provides methods to interact with the MetaMask Snap state and manage BIP-32 entropy.
 * It supports encrypted state management and provides methods to get and set the state, as well as retrieve
 * private and public entropy for given derivation paths.
 */
export class SnapStore {
  protected readonly _encrypt: boolean;

  constructor(encrypt = false) {
    this._encrypt = encrypt;
  }

  /**
   * Get the Snap state.
   * @returns The Snap state.
   */
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

  /**
   * Set the Snap state.
   * @param newState - The new state.
   */
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

  /**
   * Get the private SLIP10 for a given derivation path from the Snap SRP.
   * @param derivationPath - The derivation path.
   * @returns The private SLIP10 node.
   */
  async getPrivateEntropy(derivationPath: string[]): Promise<JsonSLIP10Node> {
    return await snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path: derivationPath,
        curve: 'secp256k1',
      },
    });
  }

  /**
   * Get the public SLIP10 for a given derivation path from the Snap SRP.
   * @param derivationPath - The derivation path.
   * @returns The public SLIP10 node.
   */
  async getPublicEntropy(derivationPath: string[]): Promise<SLIP10Node> {
    // TODO: Use the public entropy endpoint when available
    const slip10 = await this.getPrivateEntropy(derivationPath);
    return (await SLIP10Node.fromJSON(slip10)).neuter();
  }
}
