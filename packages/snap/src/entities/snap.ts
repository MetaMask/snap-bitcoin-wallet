import type { JsonSLIP10Node, SLIP10Node } from '@metamask/key-tree';

export type SnapState = {
  accounts: {
    derivationPaths: Record<string, string>;
    wallets: Record<string, string>;
  };
};

/**
 * The SnapClient represents the MetaMask Snap state and manages the BIP-32 entropy from the Wallet SRP.
 */
export type SnapClient = {
  /**
   * Get the Snap state.
   * @returns The Snap state.
   */
  get(): Promise<SnapState>;

  /**
   * Set the Snap state.
   * @param newState - The new state.
   */
  set(newState: SnapState): Promise<void>;

  /**
   * Get the private SLIP10 for a given derivation path from the Snap SRP.
   * @param derivationPath - The derivation path.
   * @returns The private SLIP10 node.
   */
  getPrivateEntropy(derivationPath: string[]): Promise<JsonSLIP10Node>;

  /**
   * Get the public SLIP10 for a given derivation path from the Snap SRP.
   * @param derivationPath - The derivation path.
   * @returns The public SLIP10 node.
   */
  getPublicEntropy(derivationPath: string[]): Promise<SLIP10Node>;
};
