import type { AddressType, Network, DescriptorPair } from 'bdk_wasm';
import {
  slip10_to_extended,
  xpriv_to_descriptor,
  xpub_to_descriptor,
} from 'bdk_wasm';
import { v4 } from 'uuid';

import type { AccountRepository } from '.';
import type { BitcoinAccount } from '../entities';
import type { SnapStore } from '../infra';
import { BdkAccountAdapter } from '../infra';

export class SnapAccountRepository implements AccountRepository {
  protected readonly _store: SnapStore;

  constructor(store: SnapStore) {
    this._store = store;
  }

  async get(id: string): Promise<BitcoinAccount | null> {
    const state = await this._store.get();
    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return null;
    }

    return BdkAccountAdapter.load(id, walletData);
  }

  async getByDerivationPath(
    derivationPath: string[],
  ): Promise<BitcoinAccount | null> {
    const derivationPathId = derivationPath.join('/');
    const state = await this._store.get();

    const id = state.accounts.derivationPaths[derivationPathId];
    if (!id) {
      return null;
    }

    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return null;
    }

    return BdkAccountAdapter.load(id, walletData);
  }

  async insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount> {
    const slip10 = await this._store.getSLIP10(derivationPath);
    const id = v4();
    console.log('id', id);
    const fingerprint = (
      slip10.masterFingerprint ?? slip10.parentFingerprint
    ).toString(16);

    // Xpub for watch-only or xpriv for signing capabilities depending on the slip10 node
    let descriptors: DescriptorPair;
    if (slip10.privateKey) {
      const xpriv = slip10_to_extended(slip10, network);
      descriptors = xpriv_to_descriptor(
        xpriv,
        fingerprint,
        network,
        addressType,
      );
    } else {
      const xpub = slip10_to_extended(slip10, network);
      descriptors = xpub_to_descriptor(xpub, fingerprint, network, addressType);
    }

    const account = BdkAccountAdapter.create(id, descriptors, network);

    const state = await this._store.get();
    state.accounts.derivationPaths[derivationPath.join('/')] = id;
    state.accounts.wallets[id] = account.takeStaged()?.to_json() ?? '';
    await this._store.set(state);

    return account;
  }
}
