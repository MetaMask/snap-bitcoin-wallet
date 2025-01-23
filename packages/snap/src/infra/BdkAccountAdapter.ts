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
} from 'bitcoindevkit';
import { Wallet } from 'bitcoindevkit';

import type { BitcoinAccount } from '../entities';

export class BdkAccountAdapter implements BitcoinAccount {
  readonly #id: string;

  readonly #wallet: Wallet;

  constructor(id: string, wallet: Wallet) {
    this.#id = id;
    this.#wallet = wallet;
  }

  static create(
    id: string,
    descriptors: DescriptorPair,
    network: Network,
  ): BdkAccountAdapter {
    return new BdkAccountAdapter(id, Wallet.create(network, descriptors));
  }

  static load(id: string, walletData: ChangeSet): BdkAccountAdapter {
    return new BdkAccountAdapter(id, Wallet.load(walletData));
  }

  get id(): string {
    return this.#id;
  }

  get balance(): Balance {
    return this.#wallet.balance();
  }

  get addressType(): AddressType {
    const addressType = this.peekAddress(0).address_type;
    if (!addressType) {
      throw new Error(
        'unknown, non-standard or related to the future witness version.',
      );
    }

    return addressType;
  }

  get network(): Network {
    return this.#wallet.network();
  }

  get isScanned(): boolean {
    return this.#wallet.latest_checkpoint().height > 0;
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

  applyUpdate(update: Update) {
    return this.#wallet.apply_update(update);
  }

  takeStaged(): ChangeSet | undefined {
    return this.#wallet.take_staged();
  }
}
