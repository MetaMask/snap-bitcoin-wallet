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
  LocalOutput,
} from 'bitcoindevkit';

import type { Inscription } from './meta-protocols';
import type { TransactionBuilder } from './transaction';

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
   * @param index - derivation index.
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
   * Extract the change set if it exists.
   * @returns the change set
   */
  takeStaged(): ChangeSet | undefined;

  /**
   * Returns a Transaction Builder.
   * @returns the TxBuilder
   */
  buildTx(): TransactionBuilder;

  /**
   * Sign a PSBT with all the registered signers
   * @param psbt - The PSBT to be signed.
   * @returns the signed transaction
   */
  sign(psbt: Psbt): Transaction;

  /**
   * Get the list of UTXOs
   * @returns the list of UTXOs
   */
  listUnspent(): LocalOutput[];

  /**
   * List all relevant outputs (includes both spent and unspent, confirmed and unconfirmed).
   * @returns the list of outputs
   */
  listOutput(): LocalOutput[];
};

/**
 * BitcoinAccountRepository is a repository that manages Bitcoin accounts.
 */
export type BitcoinAccountRepository = {
  /**
   * Get an account by its id.
   * @param id - Account ID.
   * @returns the account or null if it does not exist
   */
  get(id: string): Promise<BitcoinAccount | null>;

  /**
   * Get an account by its id with signing capabilities
   * @param id - Account ID.
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
   * @param derivationPath - derivation path.
   * @returns the account or null if it does not exist
   */
  getByDerivationPath(derivationPath: string[]): Promise<BitcoinAccount | null>;

  /**
   * Insert a new account.
   * @param derivationPath - derivation index.
   * @param network - network.
   * @param addressType - address type.
   * @returns the new account
   */
  insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount>;

  /**
   * Update an account.
   * @param account - Bitcoin account.
   * @param inscriptions - List of inscriptions.
   */
  update(account: BitcoinAccount, inscriptions?: Inscription[]): Promise<void>;

  /**
   * Delete an account.
   * @param id - Account ID.
   * @returns true if the account has been deleted.
   */
  delete(id: string): Promise<void>;

  /**
   * Get the list of frozen UTXO outpoints of an account.
   * @param id - Account ID.
   * @returns the frozen UTXO outpoints.
   */
  getFrozenUTXOs(id: string): Promise<string[]>;
};
