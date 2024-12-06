import { AddressInfo, Balance, KeychainKind, Network, Wallet } from 'bdk_wasm';
import { BitcoinAccount } from '../entities';

export class BdkAccountAdapter implements BitcoinAccount {
  protected readonly _id: string;
  protected readonly _wallet: Wallet;

  constructor(id: string, wallet: Wallet) {
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

  balance(): Balance {
    return this._wallet.balance();
  }

  peekAddress(index: number): AddressInfo {
    return this._wallet.peek_address(KeychainKind.External, index);
  }

  nextUnusedAddress(): AddressInfo {
    return this._wallet.next_unused_address(KeychainKind.External);
  }

  takeStaged(): any {
    return this._wallet.take_staged();
  }
}
