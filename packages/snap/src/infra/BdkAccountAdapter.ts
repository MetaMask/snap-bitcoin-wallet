import type {
  AddressInfo,
  AddressType,
  Balance,
  DescriptorPair,
  FullScanRequest,
  Network,
  SyncRequest,
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
import {
  UnconfirmedTx,
  SignOptions,
  Txid,
  Wallet,
} from '@metamask/bitcoindevkit';

import {
  ValidationError,
  WalletError,
  type BitcoinAccount,
  type TransactionBuilder,
} from '../entities';
import { BdkTxBuilderAdapter } from './BdkTxBuilderAdapter';

export class BdkAccountAdapter implements BitcoinAccount {
  readonly #id: string;

  readonly #derivationPath: string[];

  readonly #wallet: Wallet;

  constructor(id: string, derivationPath: string[], wallet: Wallet) {
    this.#id = id;
    this.#derivationPath = derivationPath;
    this.#wallet = wallet;
  }

  static create(
    id: string,
    derivationPath: string[],
    descriptors: DescriptorPair,
    network: Network,
  ): BdkAccountAdapter {
    return new BdkAccountAdapter(
      id,
      derivationPath,
      Wallet.create(network, descriptors.external, descriptors.internal),
    );
  }

  static load(
    id: string,
    derivationPath: string[],
    walletData: ChangeSet,
    descriptors?: DescriptorPair,
  ): BdkAccountAdapter {
    // Load with signer
    if (descriptors) {
      return new BdkAccountAdapter(
        id,
        derivationPath,
        Wallet.load(walletData, descriptors.external, descriptors.internal),
      );
    }

    return new BdkAccountAdapter(id, derivationPath, Wallet.load(walletData));
  }

  get id(): string {
    return this.#id;
  }

  get derivationPath(): string[] {
    return this.#derivationPath;
  }

  get entropySource(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.#derivationPath[0]!; // Must be defined by assertion
  }

  get accountIndex(): number {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const segment = this.#derivationPath[3]!;
    const numericPart = segment.endsWith("'") ? segment.slice(0, -1) : segment;
    return Number(numericPart);
  }

  get balance(): Balance {
    return this.#wallet.balance;
  }

  get addressType(): AddressType {
    const addressType = this.peekAddress(0).address_type;
    if (!addressType) {
      throw new WalletError(
        'unknown, non-standard or related to the future witness version.',
      );
    }

    return addressType;
  }

  get network(): Network {
    return this.#wallet.network;
  }

  get publicAddress(): Address {
    return this.peekAddress(0).address;
  }

  peekAddress(index: number): AddressInfo {
    return this.#wallet.peek_address('external', index);
  }

  nextUnusedAddress(): AddressInfo {
    return this.#wallet.next_unused_address('external');
  }

  revealNextAddress(): AddressInfo {
    return this.#wallet.reveal_next_address('external');
  }

  startFullScan(): FullScanRequest {
    return this.#wallet.start_full_scan();
  }

  startSync(): SyncRequest {
    return this.#wallet.start_sync_with_revealed_spks();
  }

  applyUpdate(update: Update): void {
    return this.#wallet.apply_update(update);
  }

  takeStaged(): ChangeSet | undefined {
    return this.#wallet.take_staged();
  }

  buildTx(): TransactionBuilder {
    return new BdkTxBuilderAdapter(this.#wallet.build_tx(), this.network);
  }

  sign(psbt: Psbt): Transaction {
    const success = this.#wallet.sign(psbt, new SignOptions());
    if (!success) {
      throw new WalletError('failed to sign PSBT');
    }

    try {
      return psbt.extract_tx();
    } catch (error) {
      throw new ValidationError(
        'failed to extract transaction from PSBT',
        { id: this.#id },
        error,
      );
    }
  }

  listUnspent(): LocalOutput[] {
    return this.#wallet.list_unspent();
  }

  listTransactions(): WalletTx[] {
    return this.#wallet.transactions();
  }

  getTransaction(txid: string): WalletTx | undefined {
    return this.#wallet.get_tx(Txid.from_string(txid));
  }

  calculateFee(tx: Transaction): Amount {
    return this.#wallet.calculate_fee(tx.clone());
  }

  isMine(script: ScriptBuf): boolean {
    return this.#wallet.is_mine(script);
  }

  sentAndReceived(tx: Transaction): [Amount, Amount] {
    const sentAndReceived = this.#wallet.sent_and_received(tx.clone());
    return [sentAndReceived[0], sentAndReceived[1]];
  }

  applyUnconfirmedTx(tx: Transaction, lastSeen: number): void {
    this.#wallet.apply_unconfirmed_txs([
      new UnconfirmedTx(tx, BigInt(lastSeen)),
    ]);
  }
}
