import type { JsonSLIP10Node } from '@metamask/key-tree';
import { SLIP10Node } from '@metamask/key-tree';

export type State = {
  accounts: {
    derivationPaths: Record<string, string>;
    wallets: Record<string, string>;
  };
};

/**
 * The SnapStore represents the MetaMask Snap state and manages the BIP-32 entropy from the Wallet SRP.
 * It supports encryption of the state.
 */
export class SnapStore {
  readonly #encrypt: boolean;

  constructor(encrypt = false) {
    this.#encrypt = encrypt;
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
        encrypted: this.#encrypt,
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
        encrypted: this.#encrypt,
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
