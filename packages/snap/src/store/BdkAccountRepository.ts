import {
  AddressType,
  EsploraWallet,
  KeychainKind,
  Network,
  slip10_to_extended,
} from 'bdk_wasm';
import { stringify, parse } from 'superjson';
import { v4 as uuidv4 } from 'uuid';

import type { AccountRepository } from '.';
import { BdkAccountAdapter } from '../adapters';
import type { BitcoinAccount } from '../entities';
import type { SnapState } from './models';
import { ConfigV2 } from '../configv2';

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

const networkNameToNetwork = {
  bitcoin: Network.Bitcoin,
  testnet: Network.Testnet,
  testnet4: Network.Testnet4,
  signet: Network.Signet,
  regtest: Network.Regtest,
};

export class BdkAccountRepository implements AccountRepository {
  protected readonly _accountIndex: number;

  constructor(accountIndex: number) {
    this._accountIndex = accountIndex;
  }

  async get(id: string): Promise<BitcoinAccount | null> {
    const state = await this.#getState();
    const walletData = this.#decodeWallet(state, id);
    if (!walletData) {
      return null;
    }

    const url = ConfigV2.chain.url[networkNameToNetwork[walletData.network]];
    return new BdkAccountAdapter(id, EsploraWallet.load(walletData, url));
  }

  async list(): Promise<string[]> {
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
    const url = ConfigV2.chain.url[network];

    const state = await this.#getState();

    // Idempotent account creation + ensures only one account per derivation path
    const derivationPathId = derivationPath.join('/');
    const existingId = state.accounts.derivationPaths[derivationPathId];
    if (existingId) {
      const walletData = this.#decodeWallet(state, existingId);
      if (walletData) {
        return new BdkAccountAdapter(
          existingId,
          EsploraWallet.load(walletData, url),
        );
      }
    }

    const slip10 = await snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path: derivationPath,
        curve: 'secp256k1',
      },
    });
    const fingerprint = slip10.masterFingerprint ?? slip10.parentFingerprint;

    let wallet: EsploraWallet;
    if (slip10.privateKey) {
      const xpriv = slip10_to_extended(slip10, network);
      wallet = EsploraWallet.from_xpriv(
        xpriv,
        fingerprint.toString(16),
        network,
        addressType,
        url,
      );
    } else {
      const xpub = slip10_to_extended(slip10, network);
      wallet = EsploraWallet.from_xpub(
        xpub,
        fingerprint.toString(16),
        network,
        addressType,
        url,
      );
    }
    wallet.next_unused_address(KeychainKind.External);

    const id = uuidv4();
    const account = new BdkAccountAdapter(id, wallet);
    state.accounts.wallets[id] = stringify(account.takeStaged());
    state.accounts.derivationPaths[derivationPathId] = id;
    await this.#setState(state);

    return account;
  }

  async update(account: BitcoinAccount): Promise<void> {
    const state = await this.#getState();
    const walletData = this.#decodeWallet(state, account.id);
    if (!walletData) {
      state.accounts.wallets[account.id] = stringify(account.takeStaged());
      return this.#setState(state);
    }

    state.accounts.wallets[account.id] = stringify(
      account.takeMerged(walletData),
    );
    await this.#setState(state);
  }

  async delete(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  #decodeWallet(state: SnapState, id: string) {
    const walletState = state.accounts.wallets[id];
    if (!walletState) {
      return null;
    }

    return parse(walletState) as any;
  }

  async #getState(): Promise<SnapState> {
    const state = await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'get',
        encrypted: false,
      },
    });

    return (
      (state as SnapState) ?? { accounts: { derivationPaths: {}, wallets: {} } }
    );
  }

  async #setState(newState: SnapState): Promise<void> {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState,
        encrypted: false,
      },
    });
  }
}
