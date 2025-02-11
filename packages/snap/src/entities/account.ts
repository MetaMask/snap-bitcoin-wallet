import type {
  FullScanRequest,
  SyncRequest,
  AddressInfo,
  AddressType,
  Balance,
  Network,
  Update,
  ChangeSet,
  Psbt,
  Transaction,
} from 'bitcoindevkit';

/**
 * A Bitcoin account.
 */
export type BitcoinAccount = {
  /**
   * The id of the account.
   */
  id: string;

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

  /**
   * Create a new PSBT.
   * @param feeRate. - The fee rate in sats/vb
   * @param recipient. - The recipient address
   * @param amount. - The amount to send in sats
   * @returns the PSBT
   */
  buildTx(feeRate: number, recipient: string, amount: string): Psbt;

  /**
   * Create a new PSBT by draining the wallet inputs.
   * @param feeRate. - The fee rate in sats/vb
   * @param recipient. - The recipient address
   * @returns the PSBT
   */
  drainTo(feeRate: number, recipient: string): Psbt;

  /**
   * Sign a PSBT with all the registered signers
   * @param psbt
   * @returns the signed transaction
   */
  sign(psbt: Psbt): Transaction;
};

/**
 * BitcoinAccountRepository is a repository that manages Bitcoin accounts.
 */
export type BitcoinAccountRepository = {
  /**
   * Get an account by its id.
   * @param id
   * @returns the account or null if it does not exist
   */
  get(id: string): Promise<BitcoinAccount | null>;

  /**
   * Get an account by its id with signing capabilities
   * @param id
   * @returns the account or null if it does not exist
   */
  getWithSigner(id: string): Promise<BitcoinAccount | null>;

  /**
   * Get all accounts.
   * @returns the list of accounts
   */
  getAll(): Promise<BitcoinAccount[]>;

  /**
   * Get an account by its derivation path.
   * @param derivationPath
   * @returns the account or null if it does not exist
   */
  getByDerivationPath(derivationPath: string[]): Promise<BitcoinAccount | null>;

  /**
   * Insert a new account.
   * @param derivationPath
   * @param network
   * @param addressType
   * @returns the new account
   */
  insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount>;

  /**
   * Update an account.
   * @param account
   */
  update(account: BitcoinAccount): Promise<void>;

  /**
   * Delete an account.
   * @param id
   * @returns true if the account has been deleted.
   */
  delete(id: string): Promise<void>;
};
