import type { JsonSLIP10Node, SLIP10Node } from '@metamask/key-tree';
import type {
  ComponentOrElement,
  GetPreferencesResult,
} from '@metamask/snaps-sdk';
import type { Json } from '@metamask/utils';

import type { BitcoinAccount } from './account';
import type { Inscription } from './meta-protocols';

export type SnapState = {
  accounts: {
    derivationPaths: Record<string, string>;
    wallets: Record<string, string>;
    inscriptions: Record<string, Inscription[]>;
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
   * Emit an event notifying the extension of a newly created Bitcoin account
   * @param account - The Bitcoin account.
   */
  emitAccountCreatedEvent(account: BitcoinAccount): Promise<void>;

  /**
   * Emit an event notifying the extension of a deleted Bitcoin account
   * @param id - The Bitcoin account id.
   */
  emitAccountDeletedEvent(id: string): Promise<void>;

  /**
   * Emit an event notifying the extension of updated balances
   * @param account - The Bitcoin account.
   */
  emitAccountBalancesUpdatedEvent(account: BitcoinAccount): Promise<void>;

  /**
   * Create a User Interface.
   * @param ui - The UI Component.
   * @param context - The Interface context.
   * @returns the interface ID
   */
  createInterface(
    ui: ComponentOrElement,
    context: Record<string, Json>,
  ): Promise<string>;

  /**
   * Update a User Interface.
   * @param id - The interface id.
   * @param ui - The user interface.
   * @param context - The Interface context.
   */
  updateInterface(
    id: string,
    ui: ComponentOrElement,
    context: Record<string, Json>,
  ): Promise<void>;

  /**
   * Display a User Interface.
   * @param id - The interface id.
   * @returns the resolved value or null.
   */
  displayInterface<ResolveType>(id: string): Promise<ResolveType | null>;

  /**
   * Resolve a User Interface.
   * @param id - The interface id.
   * @param value - The resolved value.
   */
  resolveInterface(id: string, value: Json): Promise<void>;

  /**
   * Get the state of an interface.
   * @param id - The interface id.
   * @param field - The field to return from the state.
   * @returns the interface state value if it exists.
   */
  getInterfaceState<InterfaceStateType>(
    id: string,
    field: string,
  ): Promise<InterfaceStateType | undefined>;

  /**
   * Get the context of an interface.
   * @param id - The interface id.
   * @returns the context value if it exists.
   */
  getInterfaceContext<InterfaceContextType>(
    id: string,
  ): Promise<InterfaceContextType | undefined>;

  /**
   * Schedule a one-off callback.
   * @param interval - The interval in seconds before the event is executed.
   * @param method - The method to call on reception of the event being triggered.
   * @param interfaceId - The interface id.
   * @returns the background event id.
   */
  scheduleBackgroundEvent(
    interval: string,
    method: string,
    interfaceId: string,
  ): Promise<string>;

  /**
   * Cancel an already scheduled background event.
   * @param id - The background event id.
   */
  cancelBackgroundEvent(id: string): Promise<void>;

  /**
   * Get user preferences.
   * @returns the user's preferences.
   */
  getPreferences(): Promise<GetPreferencesResult>;
};
