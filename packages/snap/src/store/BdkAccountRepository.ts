import { AddressType, Network, slip10_to_extended, Wallet } from 'bdk_wasm';
import { BitcoinAccount } from '../entities';
import { AccountRepository } from '.';
import { BdkAccountAdapter } from '../adapters';
import { stringify } from 'superjson';
import { SnapState } from './models';

const addressTypeToPurpose = {
  [AddressType.P2pkh]: "44'",
  [AddressType.P2sh]: "49'",
  [AddressType.P2wpkh]: "84'",
  [AddressType.P2tr]: "86'",
};

const networkToCoinType = {
  [Network.Bitcoin]: "0'",
  [Network.Testnet]: "1'",
  [Network.Testnet4]: "1'",
  [Network.Signet]: "1'",
  [Network.Regtest]: "1'",
};

export class BdkAccountRepository implements AccountRepository {
  protected readonly _accountIndex: number;

  constructor(accountIndex: number) {
    this._accountIndex = accountIndex;
  }

  get(id: string): Promise<BitcoinAccount | null> {
    throw new Error('Method not implemented.');
  }

  list(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  async insert(
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount> {
    const derivationPath = [
      'm',
      addressTypeToPurpose[addressType],
      networkToCoinType[network],
      `${this._accountIndex}'`,
    ];

    let state = await this.#getAccountsState();
    const id = derivationPath.join('/');

    const slip10 = await snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path: derivationPath,
        curve: 'secp256k1',
      },
    });
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

    const account = new BdkAccountAdapter(id, wallet);
    state.accounts[id] = stringify(account.takeStaged());
    await this.#setAccountsState(state);

    return account;
  }

  update(id: string, wallet: BitcoinAccount): Promise<BitcoinAccount> {
    throw new Error('Method not implemented.');
  }

  delete(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async #getAccountsState(): Promise<SnapState> {
    const state = await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'get',
      },
    });

    return (state as SnapState) ?? { accounts: {} };
  }

  async #setAccountsState(newState: SnapState): Promise<void> {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState,
      },
    });
  }
}
