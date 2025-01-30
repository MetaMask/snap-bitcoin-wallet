import type { JsonSLIP10Node, SLIP10Node } from '@metamask/key-tree';
import type { Json, SnapsProvider } from '@metamask/snaps-sdk';

import type { BitcoinAccount } from './account';
import { UserInterface } from './ui';

export type SnapState = {
  interfaces: {
    sendForms: Record<string, Json>;
  };
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
   * The snap global provider instance
   */
  provider: SnapsProvider;

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

  /**
   * Emits an event notifying the extension of a newly created Bitcoin account
   * @param account - The Bitcoin account.
   */
  emitAccountCreatedEvent(account: BitcoinAccount): Promise<void>;

  /**
   * Emits an event notifying the extension of a deleted Bitcoin account
   * @param account - The Bitcoin account id.
   */
  emitAccountDeletedEvent(id: string): Promise<void>;

  /**
   * Creates a User Interface.
   * @param params - The interface parameters.
   */
  createInterface(params: UserInterface): Promise<string>;

  /**
   * Displays a User Interface.
   * @param params - The interface id.
   */
  displayInterface<T>(id: string): Promise<T>;
};
