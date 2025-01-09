import type {
  AddressInfo,
  AddressType,
  Balance,
  DescriptorPair,
  Network,
} from 'bitcoindevkit';
import { Wallet, ChangeSet } from 'bitcoindevkit';

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

  static load(id: string, walletData: string): BdkAccountAdapter {
    const changeSet = ChangeSet.from_json(walletData);
    return new BdkAccountAdapter(id, Wallet.load(changeSet));
  }

  get id(): string {
    return this.#id;
  }

  get suggestedName(): string {
    switch (this.#wallet.network()) {
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

  peekAddress(index: number): AddressInfo {
    return this.#wallet.peek_address('external', index);
  }

  nextUnusedAddress(): AddressInfo {
    return this.#wallet.next_unused_address('external');
  }

  revealNextAddress(): AddressInfo {
    return this.#wallet.reveal_next_address('external');
  }

  takeStaged(): ChangeSet | undefined {
    return this.#wallet.take_staged();
  }
}
