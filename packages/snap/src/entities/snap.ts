import type { JsonSLIP10Node, SLIP10Node } from '@metamask/key-tree';
import type { DialogResult } from '@metamask/snaps-sdk';

import type { BitcoinAccount } from './account';
import type { TransactionRequest } from './transaction';

export type SnapState = {
  accounts: {
    derivationPaths: Record<string, string>;
    wallets: Record<string, string>;
  };
};

/**
 * The SnapClient represents the interface to MetaMask.
 */
export type SnapClient = {
  state: StorageClient;
  entropy: EntropyClient;
  events: EventEmitter;
  ui: UIClient;
};

/**
 * The SnapClient represents the MetaMask Snap storage.
 */
export type StorageClient = {
  /**
   * Get the Snap state.
   * @returns The Snap state.
   */
  get(): Promise<SnapState>;

  /**
   * Updates the Snap state.
   * @param newState - The new state.
   */
  update(newState: SnapState): Promise<void>;
};

/**
 * The EntropyClient manages the BIP-32 entropy from the Wallet SRP.
 */
export type EntropyClient = {
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

/**
 * The EventEmitter emits events to MetaMask.
 */
export type EventEmitter = {
  /**
   * Emits an event notifying the extension of a newly created Bitcoin account
   * @param account - The Bitcoin account.
   */
  accountCreated(account: BitcoinAccount): Promise<void>;

  /**
   * Emits an event notifying the extension of a deleted Bitcoin account
   * @param account - The Bitcoin account id.
   */
  accountDeleted(id: string): Promise<void>;
};

/**
 * The UIClient creates the MetaMask UI interfaces.
 */
export type UIClient = {
  /**
   * Creates and sends a UI dialog with the specified interface ID.
   *
   * @param id - The ID of the interface to create the dialog for.
   * @returns A Promise that resolves to the result of the dialog request.
   */
  dialog(id: string): Promise<DialogResult>;

  /**
   * Creates the send flow interface.
   *
   * @param account - The Bitcoin account.
   * @param request - The Bitcoin transaction request.
   * @returns The interface ID.
   */
  createTransactionRequest(
    account: BitcoinAccount,
    request: TransactionRequest,
  ): Promise<string>;
};
