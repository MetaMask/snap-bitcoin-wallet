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
  protected readonly _id: string;

  protected readonly _wallet: Wallet;

  constructor(id: string, wallet: Wallet) {
    this._id = id;
    this._wallet = wallet;
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
    return this._id;
  }

  get suggestedName(): string {
    switch (this._wallet.network()) {
      case 'bitcoin':
        return 'Bitcoin Account';
      case 'testnet':
        return 'Bitcoin Testnet Account';
      default:
        // Leave it blank to fallback to auto-suggested name on the extension side
        return '';
    }
  }

  get balance(): Balance {
    return this._wallet.balance();
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
    return this._wallet.network();
  }

  get isScanned(): boolean {
    return this._wallet.latest_checkpoint().height > 0;
  }

  peekAddress(index: number): AddressInfo {
    return this._wallet.peek_address('external', index);
  }

  nextUnusedAddress(): AddressInfo {
    return this._wallet.next_unused_address('external');
  }

  revealNextAddress(): AddressInfo {
    return this._wallet.reveal_next_address('external');
  }

  startFullScan(): FullScanRequest {
    return this._wallet.start_full_scan();
  }

  startSync(): SyncRequest {
    return this._wallet.start_sync_with_revealed_spks();
  }

  applyUpdate(update: Update) {
    return this._wallet.apply_update(update);
  }

  takeStaged(): ChangeSet | undefined {
    return this._wallet.take_staged();
  }
}
