// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable camelcase */

import type { AddressType, Network } from '@metamask/bitcoindevkit';
import {
  ChangeSet,
  slip10_to_extended,
  xpriv_to_descriptor,
  xpub_to_descriptor,
} from '@metamask/bitcoindevkit';
import { v4 } from 'uuid';

import type {
  BitcoinAccountRepository,
  BitcoinAccount,
  SnapClient,
  Inscription,
} from '../entities';
import { BdkAccountAdapter } from '../infra';

export class BdkAccountRepository implements BitcoinAccountRepository {
  readonly #snapClient: SnapClient;

  constructor(snapClient: SnapClient) {
    this.#snapClient = snapClient;
  }

  async get(id: string): Promise<BitcoinAccount | null> {
    const state = await this.#snapClient.get();
    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return null;
    }

    return BdkAccountAdapter.load(id, ChangeSet.from_json(walletData));
  }

  async fetchInscriptions(id: string): Promise<Inscription[] | null> {
    const state = await this.#snapClient.get();
    const inscriptions = state.accounts.inscriptions[id];
    if (!inscriptions) {
      return null;
    }

    return inscriptions;
  }

  async getWithSigner(id: string): Promise<BitcoinAccount | null> {
    const state = await this.#snapClient.get();
    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return null;
    }
    const account = BdkAccountAdapter.load(id, ChangeSet.from_json(walletData));

    const derivationPath = Object.entries(state.accounts.derivationPaths).find(
      ([, walletId]) => walletId === id,
    );

    // Should never occur by assertion. It is a critical inconsistent state error that should be caught in integration tests
    if (!derivationPath) {
      throw new Error(
        `Inconsistent state. No derivation path found for account ${id}`,
      );
    }

    const slip10 = await this.#snapClient.getPrivateEntropy(
      derivationPath[0].split('/'),
    );
    const fingerprint = (
      slip10.masterFingerprint ?? slip10.parentFingerprint
    ).toString(16);
    const xpriv = slip10_to_extended(slip10, account.network);
    const descriptors = xpriv_to_descriptor(
      xpriv,
      fingerprint,
      account.network,
      account.addressType,
    );

    return BdkAccountAdapter.load(
      id,
      ChangeSet.from_json(walletData),
      descriptors,
    );
  }

  async getAll(): Promise<BitcoinAccount[]> {
    const state = await this.#snapClient.get();
    const walletsData = state.accounts.wallets;

    return Object.entries(walletsData).map(([id, walletData]) =>
      BdkAccountAdapter.load(id, ChangeSet.from_json(walletData)),
    );
  }

  async getByDerivationPath(
    derivationPath: string[],
  ): Promise<BitcoinAccount | null> {
    const derivationPathId = derivationPath.join('/');
    const state = await this.#snapClient.get();

    const id = state.accounts.derivationPaths[derivationPathId];
    if (!id) {
      return null;
    }

    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return null;
    }

    return BdkAccountAdapter.load(id, ChangeSet.from_json(walletData));
  }

  async insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount> {
    const slip10 = await this.#snapClient.getPublicEntropy(derivationPath);
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

    const state = await this.#snapClient.get();
    state.accounts.derivationPaths[derivationPath.join('/')] = id;
    state.accounts.wallets[id] = account.takeStaged()?.to_json() ?? '';
    state.accounts.inscriptions[id] = [];
    await this.#snapClient.set(state);

    return account;
  }

  async update(
    account: BitcoinAccount,
    inscriptions?: Inscription[],
  ): Promise<void> {
    const newWalletData = account.takeStaged();
    if (!newWalletData) {
      // Nothing to update
      return;
    }

    const state = await this.#snapClient.get();
    const walletData = state.accounts.wallets[account.id];
    if (!walletData) {
      throw new Error('Inconsistent state: account not found for update');
    }

    newWalletData.merge(ChangeSet.from_json(walletData));
    state.accounts.wallets[account.id] = newWalletData.to_json();
    if (inscriptions) {
      state.accounts.inscriptions[account.id] = inscriptions;
    }
    await this.#snapClient.set(state);
  }

  async delete(id: string): Promise<void> {
    const state = await this.#snapClient.get();
    const walletData = state.accounts.wallets[id];
    if (!walletData) {
      return;
    }

    delete state.accounts.wallets[id];
    delete state.accounts.inscriptions[id];

    // Find the path in derivationPaths that points to this id and remove it
    for (const [path, existingId] of Object.entries(
      state.accounts.derivationPaths,
    )) {
      if (existingId === id) {
        delete state.accounts.derivationPaths[path];
        break;
      }
    }

    await this.#snapClient.set(state);
  }

  async getFrozenUTXOs(id: string): Promise<string[]> {
    const state = await this.#snapClient.get();
    const inscriptions = state.accounts.inscriptions[id];
    if (!inscriptions) {
      return [];
    }

    return inscriptions.map((inscription) => {
      // format: <txid>:<vout>:<offset>
      const [txid, vout] = inscription.location.split(':');
      return `${txid}:${vout}`;
    });
  }
}
