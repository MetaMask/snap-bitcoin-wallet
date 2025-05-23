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
  AccountState,
  SnapState,
} from '../entities';
import { BdkAccountAdapter } from '../infra';

// Developers should not worry about concurrency issues due to
export class BdkAccountRepository implements BitcoinAccountRepository {
  readonly #snapClient: SnapClient;

  constructor(snapClient: SnapClient) {
    this.#snapClient = snapClient;
  }

  async get(id: string): Promise<BitcoinAccount | null> {
    const account = (await this.#snapClient.getState(
      `accounts.${id}`,
    )) as AccountState | null;
    if (!account) {
      return null;
    }

    return BdkAccountAdapter.load(
      id,
      account.derivationPath,
      ChangeSet.from_json(account.wallet),
    );
  }

  async fetchInscriptions(id: string): Promise<Inscription[] | null> {
    const inscriptions = await this.#snapClient.getState(
      `accounts.${id}.inscriptions`,
    );
    if (!inscriptions) {
      return null;
    }

    return inscriptions as Inscription[];
  }

  async getWithSigner(id: string): Promise<BitcoinAccount | null> {
    const accountState = (await this.#snapClient.getState(
      `accounts.${id}`,
    )) as AccountState | null;
    if (!accountState) {
      return null;
    }

    const slip10 = await this.#snapClient.getPrivateEntropy(
      accountState.derivationPath,
    );
    const fingerprint = (
      slip10.masterFingerprint ?? slip10.parentFingerprint
    ).toString(16);

    const account = BdkAccountAdapter.load(
      id,
      accountState.derivationPath,
      ChangeSet.from_json(accountState.wallet),
    );

    const xpriv = slip10_to_extended(slip10, account.network);
    const privDescriptors = xpriv_to_descriptor(
      xpriv,
      fingerprint,
      account.network,
      account.addressType,
    );

    return BdkAccountAdapter.load(
      id,
      account.derivationPath,
      ChangeSet.from_json(accountState.wallet),
      privDescriptors,
    );
  }

  async getAll(): Promise<BitcoinAccount[]> {
    const accounts = await this.#snapClient.getState('accounts');
    if (!accounts) {
      return [];
    }

    return Object.entries(accounts as SnapState['accounts']).map(
      ([id, account]) =>
        BdkAccountAdapter.load(
          id,
          account.derivationPath,
          ChangeSet.from_json(account.wallet),
        ),
    );
  }

  async getByDerivationPath(
    derivationPath: string[],
  ): Promise<BitcoinAccount | null> {
    const id = await this.#snapClient.getState(
      `derivationPaths.${derivationPath.join('/')}`,
    );
    if (!id) {
      return null;
    }

    return this.get(id as string);
  }

  async create(
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

    return BdkAccountAdapter.create(id, derivationPath, descriptors, network);
  }

  async insert(account: BitcoinAccount): Promise<BitcoinAccount> {
    const { id, derivationPath } = account;

    const walletData = account.takeStaged();
    if (!walletData) {
      throw new Error(
        `Missing changeset data for account ${id} after creation.`, // Impossible by assertion
      );
    }

    await this.#snapClient.setState(
      `derivationPaths.${derivationPath.join('/')}`,
      id,
    );
    await this.#snapClient.setState(`accounts.${id}`, {
      wallet: walletData.to_json(),
      inscriptions: [],
      derivationPath,
    });

    return account;
  }

  async update(
    account: BitcoinAccount,
    inscriptions?: Inscription[],
  ): Promise<void> {
    const { id } = account;

    const newWalletData = account.takeStaged();
    if (!newWalletData) {
      // Nothing to update
      return;
    }

    const walletData = await this.#snapClient.getState(`accounts.${id}.wallet`);
    if (!walletData) {
      throw new Error('Inconsistent state: account not found for update');
    }

    newWalletData.merge(ChangeSet.from_json(walletData as string));
    await this.#snapClient.setState(
      `accounts.${id}.wallet`,
      newWalletData.to_json(),
    );

    // Inscriptions are overwritten and not merged
    if (inscriptions) {
      await this.#snapClient.setState(
        `accounts.${id}.inscriptions`,
        inscriptions,
      );
    }
  }

  async delete(id: string): Promise<void> {
    const accountState = (await this.#snapClient.getState(
      `accounts.${id}`,
    )) as AccountState | null;
    if (!accountState) {
      return;
    }

    await this.#snapClient.setState(`accounts.${id}`, null);
    await this.#snapClient.setState(
      `derivationPaths.${accountState.derivationPath.join('/')}`,
      null,
    );
  }

  async getFrozenUTXOs(id: string): Promise<string[]> {
    const inscriptions = await this.#snapClient.getState(
      `accounts.${id}.inscriptions`,
    );
    if (!inscriptions) {
      return [];
    }

    return (inscriptions as AccountState['inscriptions']).map((inscription) => {
      // format: <txid>:<vout>:<offset>
      const [txid, vout] = inscription.location.split(':');
      return `${txid}:${vout}`;
    });
  }
}
