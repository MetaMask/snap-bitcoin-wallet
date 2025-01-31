import type { JsonSLIP10Node, SLIP10Node } from '@metamask/key-tree';

import type { BitcoinAccount } from './account';
import type { UserInterface } from './ui';
import { SendFormContext } from './send-form';

export type SnapState = {
  interfaces: {
    sendForms: Record<string, SendFormContext>;
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
  displayInterface<ResolveType>(id: string): Promise<ResolveType | null>;

  /**
   * Retrieves the BTC currency rate.
   * @returns A Promise that resolves to the BTC rate.
   */
  getBtcRate(): Promise<number | undefined>;
};
