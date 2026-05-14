import type {
  AddressInfo,
  Amount,
  Balance,
  FullScanRequest,
  LocalOutput,
  Psbt,
  ScriptBuf,
  SyncRequest,
  Transaction,
  Update,
  WalletTx,
  ChangeSet,
  AddressType,
  Network,
} from '@metamask/bitcoindevkit';
import { Address } from '@metamask/bitcoindevkit';

import {
  AccountCapability,
  WalletError,
  type AccountMetadata,
  type AccountState,
  type BitcoinAccount,
  type TransactionBuilder,
} from '../entities';

type AccountStateWithMetadata = AccountState & {
  metadata: AccountMetadata;
};

export class StoredAccountAdapter implements BitcoinAccount {
  readonly #id: string;

  readonly #derivationPath: string[];

  readonly #metadata: AccountMetadata;

  readonly #capabilities: AccountCapability[];

  constructor(id: string, account: AccountStateWithMetadata) {
    this.#id = id;
    this.#derivationPath = account.derivationPath;
    this.#metadata = account.metadata;
    this.#capabilities = Object.values(AccountCapability);
  }

  static canLoad(account: AccountState): account is AccountStateWithMetadata {
    return Boolean(account.metadata);
  }

  static load(
    id: string,
    account: AccountStateWithMetadata,
  ): StoredAccountAdapter {
    return new StoredAccountAdapter(id, account);
  }

  get id(): string {
    return this.#id;
  }

  get derivationPath(): string[] {
    return this.#derivationPath;
  }

  get entropySource(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.#derivationPath[0]!;
  }

  get accountIndex(): number {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const segment = this.#derivationPath[3]!;
    const numericPart = segment.endsWith("'") ? segment.slice(0, -1) : segment;
    return Number(numericPart);
  }

  get balance(): Balance {
    return this.#unsupported();
  }

  get addressType(): AddressType {
    return this.#metadata.addressType;
  }

  get network(): Network {
    return this.#metadata.network;
  }

  get publicAddress(): Address {
    return Address.from_string(this.#metadata.address, this.#metadata.network);
  }

  get publicDescriptor(): string {
    return this.#metadata.publicDescriptor;
  }

  get capabilities(): AccountCapability[] {
    return this.#capabilities;
  }

  peekAddress(_index: number): AddressInfo {
    return this.#unsupported();
  }

  nextUnusedAddress(): AddressInfo {
    return this.#unsupported();
  }

  revealNextAddress(): AddressInfo {
    return this.#unsupported();
  }

  startFullScan(): FullScanRequest {
    return this.#unsupported();
  }

  startSync(): SyncRequest {
    return this.#unsupported();
  }

  applyUpdate(_update: Update): void {
    this.#unsupported();
  }

  takeStaged(): ChangeSet | undefined {
    return this.#unsupported();
  }

  buildTx(): TransactionBuilder {
    return this.#unsupported();
  }

  sign(_psbt: Psbt): Psbt {
    return this.#unsupported();
  }

  extractTransaction(_psbt: Psbt, _maxFeeRate?: number): Transaction {
    return this.#unsupported();
  }

  getUtxo(_outpoint: string): LocalOutput | undefined {
    return this.#unsupported();
  }

  listUnspent(): LocalOutput[] {
    return this.#unsupported();
  }

  listTransactions(): WalletTx[] {
    return this.#unsupported();
  }

  getTransaction(_txid: string): WalletTx | undefined {
    return this.#unsupported();
  }

  calculateFee(_tx: Transaction): Amount {
    return this.#unsupported();
  }

  isMine(_script: ScriptBuf): boolean {
    return this.#unsupported();
  }

  sentAndReceived(_tx: Transaction): [Amount, Amount] {
    return this.#unsupported();
  }

  applyUnconfirmedTx(_tx: Transaction, _lastSeen: number): void {
    this.#unsupported();
  }

  #unsupported(): never {
    throw new WalletError(
      'Stored account metadata cannot be used for wallet operations; load the full account first.',
      { id: this.#id },
    );
  }
}
