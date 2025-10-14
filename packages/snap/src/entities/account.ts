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
  WalletTx,
  Amount,
  ScriptBuf,
  Address,
} from '@metamask/bitcoindevkit';

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
   * Derivation path.
   */
  derivationPath: string[];

  /**
   * Account entropy source.
   */
  entropySource: string;

  /**
   * BIP44 Account index.
   */
  accountIndex: number;

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
   * The public address representing this account. Usually address at index 0.
   */
  publicAddress: Address;

  /**
   * The public descriptor of the account.
   */
  publicDescriptor: string;

  /**
   * The capabilities of the account.
   */
  capabilities: AccountCapability[];

  /**
   * Get an address at a given index.
   *
   * @param index - derivation index.
   * @returns the address
   */
  peekAddress(index: number): AddressInfo;

  /**
   * Get the next unused address. This will reveal a new address if there is no unused address.
   * Note that the account needs to be persisted for this operation to be idempotent.
   *
   * @returns the address
   */
  nextUnusedAddress(): AddressInfo;

  /**
   * Reveal the next address.
   * Note that the account needs to be persisted for this operation to be idempotent.
   *
   * @returns the address
   */
  revealNextAddress(): AddressInfo;

  /**
   * Start a full scan.
   *
   * @returns the full scan request
   */
  startFullScan(): FullScanRequest;

  /**
   * Start a sync with revealed scripts.
   *
   * @returns the sync request
   */
  startSync(): SyncRequest;

  /**
   * Apply an update to the account.
   */
  applyUpdate(update: Update): void;

  /**
   * Extract the change set if it exists.
   *
   * @returns the change set
   */
  takeStaged(): ChangeSet | undefined;

  /**
   * Returns a Transaction Builder.
   *
   * @returns the TxBuilder
   */
  buildTx(): TransactionBuilder;

  /**
   * Sign a PSBT with all the registered signers
   *
   * @param psbt - The PSBT to be signed.
   * @returns the signed PSBT
   */
  sign(psbt: Psbt): Psbt;

  /**
   * Extract the transaction from a PSBT.
   *
   * @param psbt - The PSBT.
   * @param maxFeeRate - The maximum fee rate to use for the transaction.
   * @returns the transaction
   */
  extractTransaction(psbt: Psbt, maxFeeRate?: number): Transaction;

  /**
   * Get a UTXO by outpoint.
   *
   * @param outpoint - Outpoint of the utxo in the format <txid>:<vout>.
   * @returns the wallet UTXO or undefined if the UTXO is not found
   */
  getUtxo(outpoint: string): LocalOutput | undefined;

  /**
   * Get the list of UTXOs
   *
   * @returns the list of UTXOs
   */
  listUnspent(): LocalOutput[];

  /**
   * List relevant and canonical transactions in the wallet.
   * A transaction is relevant when it spends from or spends to at least one tracked output.
   * A transaction is canonical when it is confirmed in the best chain, or does not conflict with any transaction confirmed in the best chain.
   *
   * @returns the list of wallet transactions
   */
  listTransactions(): WalletTx[];

  /**
   * Get a single transaction from the wallet as a [`WalletTx`] (if the transaction exists).
   *
   * @returns the wallet transaction
   */
  getTransaction(txid: string): WalletTx | undefined;

  /**
   * Calculate the fee of a given transaction. Returns [`Amount::ZERO`] if `tx` is a coinbase transaction.
   *
   * @param tx - The transaction.
   * @returns the fee amount.
   */
  calculateFee(tx: Transaction): Amount;

  /**
   * Return whether or not a `script` is part of this wallet (either internal or external).
   *
   * @param script - The Bitcoin script.
   * @returns the ownership state.
   */
  isMine(script: ScriptBuf): boolean;

  /**
   * Compute the `tx`'s sent and received [`Amount`]s.
   * This method returns a tuple `(sent, received)`. Sent is the sum of the txin amounts
   * that spend from previous txouts tracked by this wallet. Received is the summation
   * of this tx's outputs that send to script pubkeys tracked by this wallet.
   *
   * @param tx - The Bitcoin transaction.
   * @returns the sent and received amounts.
   */
  sentAndReceived(tx: Transaction): [Amount, Amount];

  /**
   * Apply relevant unconfirmed transactions to the wallet.
   * Transactions that are not relevant are filtered out.
   *
   * @param tx - The Bitcoin transaction.
   * @param lastSeen - Timestamp of when the transaction was last seen in the mempool.
   */
  applyUnconfirmedTx(tx: Transaction, lastSeen: number): void;
};

export enum AccountCapability {
  SignPsbt = 'signPsbt',
  ComputeFee = 'computeFee',
  FillPsbt = 'fillPsbt',
  BroadcastPsbt = 'broadcastPsbt',
  SendTransfer = 'sendTransfer',
  GetUtxo = 'getUtxo',
  ListUtxos = 'listUtxos',
  PublicDescriptor = 'publicDescriptor',
  SignMessage = 'signMessage',
}

/**
 * BitcoinAccountRepository is a repository that manages Bitcoin accounts.
 */
export type BitcoinAccountRepository = {
  /**
   * Get an account by its id.
   *
   * @param id - Account ID.
   * @returns the account or null if it does not exist
   */
  get(id: string): Promise<BitcoinAccount | null>;

  /**
   * Get an account by its id with signing capabilities
   *
   * @param id - Account ID.
   * @returns the account or null if it does not exist
   */
  getWithSigner(id: string): Promise<BitcoinAccount | null>;

  /**
   * Get all accounts.
   *
   * @returns the list of accounts
   */
  getAll(): Promise<BitcoinAccount[]>;

  /**
   * Get an account by its derivation path.
   *
   * @param derivationPath - derivation path.
   * @returns the account or null if it does not exist
   */
  getByDerivationPath(derivationPath: string[]): Promise<BitcoinAccount | null>;

  /**
   * Create a new account, without persisting it.
   *
   * @param derivationPath - derivation path.
   * @param network - network.
   * @param addressType - address type.
   * @returns the new account
   */
  create(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount>;

  /**
   * Insert an account.
   *
   * @param account - Bitcoin account.
   */
  insert(account: BitcoinAccount): Promise<BitcoinAccount>;

  /**
   * Update an account.
   *
   * @param account - Bitcoin account.
   * @param inscriptions - List of inscriptions.
   */
  update(account: BitcoinAccount, inscriptions?: Inscription[]): Promise<void>;

  /**
   * Delete an account.
   *
   * @param id - Account ID.
   * @returns true if the account has been deleted.
   */
  delete(id: string): Promise<void>;

  /**
   * Get the list of frozen UTXO outpoints of an account.
   *
   * @param id - Account ID.
   * @returns the frozen UTXO outpoints.
   */
  getFrozenUTXOs(id: string): Promise<string[]>;

  /**
   * Set the selected accounts for synchronization.
   *
   * @param accountIds - Array of account IDs to mark as selected.
   * @returns The selected Bitcoin accounts.
   */
  setSelectedAccounts(accountIds: string[]): Promise<BitcoinAccount[]>;

  /**
   * Get all accounts that are marked as selected for synchronization.
   *
   * @returns The list of selected Bitcoin accounts.
   */
  getSelectedAccounts(): Promise<BitcoinAccount[]>;
};

export enum Purpose {
  Legacy = 44,
  Segwit = 49,
  NativeSegwit = 84,
  Taproot = 86,
  Multisig = 45,
}

export enum Slip44 {
  Bitcoin = 0,
  Testnet = 1,
}

export const addressTypeToPurpose: Record<AddressType, Purpose> = {
  p2pkh: Purpose.Legacy,
  p2sh: Purpose.Segwit,
  p2wsh: Purpose.Multisig,
  p2wpkh: Purpose.NativeSegwit,
  p2tr: Purpose.Taproot,
};

export const purposeToAddressType: Record<Purpose, AddressType> = {
  [Purpose.Legacy]: 'p2pkh',
  [Purpose.Segwit]: 'p2sh',
  [Purpose.Multisig]: 'p2wsh',
  [Purpose.NativeSegwit]: 'p2wpkh',
  [Purpose.Taproot]: 'p2tr',
};

export const networkToCoinType: Record<Network, Slip44> = {
  bitcoin: Slip44.Bitcoin,
  testnet: Slip44.Testnet,
  testnet4: Slip44.Testnet,
  signet: Slip44.Testnet,
  regtest: Slip44.Testnet,
};
