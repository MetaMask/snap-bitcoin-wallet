import type { JsonSLIP10Node } from '@metamask/key-tree';
import type { AddressInfo, AddressType, Balance } from 'bdk_wasm';
import { Wallet, KeychainKind, Network, slip10_to_extended } from 'bdk_wasm';

import type { BitcoinAccount } from '../entities';

export class BdkAccountAdapter implements BitcoinAccount {
  protected readonly _id: string;

  protected readonly _wallet: Wallet;

  constructor(id: string, wallet: Wallet) {
    this._id = id;
    this._wallet = wallet;
  }

  static fromSLIP10(
    id: string,
    slip10: JsonSLIP10Node,
    network: Network,
    addressType: AddressType,
  ): BdkAccountAdapter {
    const fingerprint = slip10.masterFingerprint ?? slip10.parentFingerprint;

    let wallet: Wallet;
    if (slip10.privateKey) {
      const xpriv = slip10_to_extended(slip10, network);
      wallet = Wallet.from_xpriv(
        xpriv,
        fingerprint.toString(16),
        network,
        addressType,
      );
    } else {
      const xpub = slip10_to_extended(slip10, network);
      wallet = Wallet.from_xpub(
        xpub,
        fingerprint.toString(16),
        network,
        addressType,
      );
    }
    return new BdkAccountAdapter(id, wallet);
  }

  static load(id: string, walletData: any): BdkAccountAdapter {
    return new BdkAccountAdapter(id, Wallet.load(walletData));
  }

  get id(): string {
    return this._id;
  }

  get suggestedName(): string {
    switch (this._wallet.network()) {
      case Network.Bitcoin:
        return 'Bitcoin Account';
      case Network.Testnet:
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

  peekAddress(index: number): AddressInfo {
    return this._wallet.peek_address(KeychainKind.External, index);
  }

  nextUnusedAddress(): AddressInfo {
    return this._wallet.next_unused_address(KeychainKind.External);
  }

  revealNextAddress(): AddressInfo {
    return this._wallet.reveal_next_address(KeychainKind.External);
  }

  takeStaged(): any {
    return this._wallet.take_staged();
  }
}
