import type {
  FullScanRequest,
  SyncRequest,
  AddressInfo,
  AddressType,
  Balance,
  Network,
  Update,
  ChangeSet,
} from 'bitcoindevkit';

/**
 * BitcoinAccount represents a Bitcoin account.
 */
export type BitcoinAccount = {
  /**
   * The id of the account.
   */
  id: string;

  /**
   * The suggested name of the account.
   */
  suggestedName: string;

  /**
   * The balance of the account.
   */
  balance: Balance;

  /**
   * The address type of the account.
   */
  addressType: AddressType;

  /**
   * The network in which the account operates.
   */
  network: Network;

  /**
   * Whether the account has already performed a full scan.
   */
  isScanned: boolean;

  /**
   * Get an address at a given index.
   * @param index
   * @returns the address
   */
  peekAddress(index: number): AddressInfo;

  /**
   * Get the next unused address. This will reveal a new address if there is no unused address.
   * Note that the account needs to be persisted for this operation to be idempotent.
   * @returns the address
   */
  nextUnusedAddress(): AddressInfo;

  /**
   * Reveal the next address.
   * Note that the account needs to be persisted for this operation to be idempotent.
   * @returns the address
   */
  revealNextAddress(): AddressInfo;

  /**
   * Start a full scan.
   * @returns the full scan request
   */
  startFullScan(): FullScanRequest;

  /**
   * Start a sync with revealed scripts.
   * @returns the sync request
   */
  startSync(): SyncRequest;

  /**
   * Apply an update to the account.
   */
  applyUpdate(update: Update): void;

  /**
   * Get the change set.
   * @returns the change set
   */
  takeStaged(): ChangeSet | undefined;
};
