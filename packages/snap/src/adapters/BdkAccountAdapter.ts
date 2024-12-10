import type {
  AddressInfo,
  AddressType,
  Balance,
  EsploraWallet,
  Wallet,
} from 'bdk_wasm';
import { KeychainKind, Network } from 'bdk_wasm';

import type { BitcoinAccount } from '../entities';

export class BdkAccountAdapter implements BitcoinAccount {
  protected readonly _id: string;

  // TODO: Use MetamaskWallet instead of Wallet from bdk-wasm once snap_manageState can handle key patches.
  protected readonly _wallet: EsploraWallet;

  constructor(id: string, wallet: EsploraWallet) {
    this._id = id;
    this._wallet = wallet;
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

  get nextUnusedAddress(): AddressInfo {
    return this._wallet.next_unused_address(KeychainKind.External);
  }

  get network(): Network {
    return this._wallet.network();
  }

  get isScanned(): boolean {
    return this._wallet.latest_checkpoint().height > 0;
  }

  peekAddress(index: number): AddressInfo {
    return this._wallet.peek_address(KeychainKind.External, index);
  }

  async fullScan(stopGap: number, parallelRequests: number) {
    await this._wallet.full_scan(stopGap, parallelRequests);
  }

  async sync(parallelRequests: number) {
    await this._wallet.sync(parallelRequests);
  }

  takeStaged(): any {
    return this._wallet.take_staged();
  }

  takeMerged(previousState: any): any {
    return this._wallet.take_merged(previousState);
  }
}
