// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable camelcase */

import type { SLIP10Node } from '@metamask/key-tree';
import type { AddressType, Network } from 'bitcoindevkit';
import {
  ChangeSet,
  slip10_to_extended,
  xpub_to_descriptor,
} from 'bitcoindevkit';
import { v4 } from 'uuid';

import type {
  BitcoinAccountRepository,
  BitcoinAccount,
  StateClient,
} from '../entities';
import { BdkAccountAdapter } from '../infra';

export class BdkAccountRepository implements BitcoinAccountRepository {
  readonly #storage: StateClient;

  constructor(storage: StateClient) {
    this.#storage = storage;
  }

  async get(id: string): Promise<BitcoinAccount | null> {
    const state = await this.#storage.get();
    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return null;
    }

    return BdkAccountAdapter.load(id, ChangeSet.from_json(walletData));
  }

  async getAll(): Promise<BitcoinAccount[]> {
    const state = await this.#storage.get();
    const walletsData = state.accounts.wallets;

    return Object.entries(walletsData).map(([id, walletData]) =>
      BdkAccountAdapter.load(id, ChangeSet.from_json(walletData)),
    );
  }

  async getByDerivationPath(
    derivationPath: string[],
  ): Promise<BitcoinAccount | null> {
    const derivationPathId = derivationPath.join('/');
    const state = await this.#storage.get();

    const id = state.accounts.derivationPaths[derivationPathId];
    if (!id) {
      return null;
    }

    return this.get(id);
  }

  async insert(
    slip10: SLIP10Node,
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount> {
    const id = v4();
    const fingerprint = (
      slip10.masterFingerprint ?? slip10.parentFingerprint
    ).toString(16);

    const xpub = slip10_to_extended(slip10, network);
    const descriptors = xpub_to_descriptor(
      xpub,
      fingerprint,
      network,
      addressType,
    );

    const account = BdkAccountAdapter.create(id, descriptors, network);

    const state = await this.#storage.get();
    state.accounts.derivationPaths[derivationPath.join('/')] = id;
    state.accounts.wallets[id] = account.takeStaged()?.to_json() ?? '';
    await this.#storage.update(state);

    return account;
  }

  async update(account: BitcoinAccount): Promise<void> {
    const state = await this.#storage.get();
    const walletData = state.accounts.wallets[account.id];
    if (!walletData) {
      throw new Error('Inconsistent state: account not found for update');
    }

    const newWalletData = account.takeStaged();
    if (!newWalletData) {
      // Nothing to update
      return;
    }

    newWalletData.merge(ChangeSet.from_json(walletData));
    state.accounts.wallets[account.id] = newWalletData.to_json();
    await this.#storage.update(state);
  }

  async delete(id: string): Promise<void> {
    const state = await this.#storage.get();
    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return;
    }

    delete state.accounts.wallets[id];

    // Find the path in derivationPaths that points to this id and remove it
    for (const [path, existingId] of Object.entries(
      state.accounts.derivationPaths,
    )) {
      if (existingId === id) {
        delete state.accounts.derivationPaths[path];
        break;
      }
    }

    await this.#storage.update(state);
  }
}
