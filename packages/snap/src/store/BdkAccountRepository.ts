// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable camelcase */

import type {
  AddressType,
  DescriptorPair,
  Network,
} from '@metamask/bitcoindevkit';
import {
  slip10_to_extended,
  xpriv_to_descriptor,
  xpub_to_descriptor,
} from '@metamask/bitcoindevkit';
import { v4 } from 'uuid';

import {
  type BitcoinAccountRepository,
  type BitcoinAccount,
  type ChainClient,
  type SnapClient,
  type Inscription,
  type AccountState,
  type SnapState,
  StorageError,
} from '../entities';
import { BdkAccountAdapter } from '../infra';

/**
 * Encode a fingerprint to a 4-bytes hex-string (required by the BDK).
 *
 * @param fingerprint - The fingerprint to encode.
 * @returns The encoded fingerprint.
 */
function toBdkFingerprint(fingerprint: number): string {
  // READ THIS CAREFULLY:
  // The BDK expects 4-bytes fingerprint, so we have to pad with 0, in case
  // our fingerprint contains leading null-bytes.
  return fingerprint.toString(16).padStart(8, '0');
}

export class BdkAccountRepository implements BitcoinAccountRepository {
  readonly #snapClient: SnapClient;

  readonly #chainClient: ChainClient;

  constructor(snapClient: SnapClient, chainClient: ChainClient) {
    this.#snapClient = snapClient;
    this.#chainClient = chainClient;
  }

  /**
   * Derive public descriptors.
   *
   * @param derivationPath - The BIP-32 derivation path.
   * @param network - The Bitcoin network.
   * @param addressType - The address type.
   * @returns The derived descriptor pair.
   */
  async #derivePublicDescriptors(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<DescriptorPair> {
    const slip10 = await this.#snapClient.getPublicEntropy(derivationPath);
    const fingerprint = toBdkFingerprint(
      slip10.masterFingerprint ?? slip10.parentFingerprint,
    );
    const xpub = slip10_to_extended(slip10, network);
    return xpub_to_descriptor(xpub, fingerprint, network, addressType);
  }

  /**
   * Derive private descriptors.
   *
   * @param derivationPath - The BIP-32 derivation path.
   * @param network - The Bitcoin network.
   * @param addressType - The address type.
   * @returns The derived descriptor pair.
   */
  async #derivePrivateDescriptors(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<DescriptorPair> {
    const slip10 = await this.#snapClient.getPrivateEntropy(derivationPath);
    const fingerprint = toBdkFingerprint(
      slip10.masterFingerprint ?? slip10.parentFingerprint,
    );
    const xpriv = slip10_to_extended(slip10, network);
    return xpriv_to_descriptor(xpriv, fingerprint, network, addressType);
  }

  /**
   * Create a fresh wallet from derived descriptors and sync with blockchain.
   *
   * @param id - The account ID.
   * @param derivationPath - The BIP-32 derivation path.
   * @param network - The Bitcoin network.
   * @param addressType - The address type.
   * @param lastRevealedIndex - The last revealed address index.
   * @param descriptors - The derived descriptor pair.
   * @returns The synced account with balance and UTXOs.
   */
  async #createAndSyncWallet(
    id: string,
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
    lastRevealedIndex: number,
    descriptors: DescriptorPair,
  ): Promise<BitcoinAccount> {
    const account = BdkAccountAdapter.create(
      id,
      derivationPath,
      descriptors,
      network,
    );

    // Reveal addresses up to stored index for efficient sync
    if (lastRevealedIndex > 0) {
      account.revealAddressesTo('external', lastRevealedIndex);
      account.revealAddressesTo('internal', lastRevealedIndex);
    }

    // Sync with blockchain to get balance and UTXOs
    await this.#chainClient.sync(account);

    return account;
  }

  async get(id: string): Promise<BitcoinAccount | null> {
    const account = (await this.#snapClient.getState(
      `accounts.${id}`,
    )) as AccountState | null;
    if (!account) {
      return null;
    }

    const descriptors = await this.#derivePublicDescriptors(
      account.derivationPath,
      account.network,
      account.addressType,
    );

    return this.#createAndSyncWallet(
      id,
      account.derivationPath,
      account.network,
      account.addressType,
      account.lastRevealedIndex,
      descriptors,
    );
  }

  async getAll(): Promise<BitcoinAccount[]> {
    const accounts = (await this.#snapClient.getState('accounts')) as
      | SnapState['accounts']
      | null;
    if (!accounts) {
      return [];
    }

    return Promise.all(
      Object.entries(accounts)
        .filter(([, account]) => account !== null)
        .map(async ([id, account]) => {
          const descriptors = await this.#derivePublicDescriptors(
            account.derivationPath,
            account.network,
            account.addressType,
          );

          return this.#createAndSyncWallet(
            id,
            account.derivationPath,
            account.network,
            account.addressType,
            account.lastRevealedIndex,
            descriptors,
          );
        }),
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

  async getWithSigner(id: string): Promise<BitcoinAccount | null> {
    const account = (await this.#snapClient.getState(
      `accounts.${id}`,
    )) as AccountState | null;
    if (!account) {
      return null;
    }

    const privDescriptors = await this.#derivePrivateDescriptors(
      account.derivationPath,
      account.network,
      account.addressType,
    );

    return this.#createAndSyncWallet(
      id,
      account.derivationPath,
      account.network,
      account.addressType,
      account.lastRevealedIndex,
      privDescriptors,
    );
  }

  async create(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount> {
    const slip10 = await this.#snapClient.getPublicEntropy(derivationPath);
    const id = v4();
    const fingerprint = toBdkFingerprint(
      slip10.masterFingerprint ?? slip10.parentFingerprint,
    );

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
    const { id, derivationPath, network, addressType } = account;

    // Get max of external and internal derivation indices
    const externalIndex = account.derivationIndex('external') ?? 0;
    const internalIndex = account.derivationIndex('internal') ?? 0;
    const lastRevealedIndex = Math.max(externalIndex, internalIndex);

    await Promise.all([
      this.#snapClient.setState(
        `derivationPaths.${derivationPath.join('/')}`,
        id,
      ),
      this.#snapClient.setState(`accounts.${id}`, {
        derivationPath,
        network,
        addressType,
        lastRevealedIndex,
        inscriptions: [],
      }),
    ]);

    return account;
  }

  async update(
    account: BitcoinAccount,
    inscriptions?: Inscription[],
  ): Promise<void> {
    const { id } = account;

    // Get max of external and internal derivation indices
    const externalIndex = account.derivationIndex('external') ?? 0;
    const internalIndex = account.derivationIndex('internal') ?? 0;
    const lastRevealedIndex = Math.max(externalIndex, internalIndex);

    await this.#snapClient.setState(
      `accounts.${id}.lastRevealedIndex`,
      lastRevealedIndex,
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
    const account = (await this.#snapClient.getState(
      `accounts.${id}`,
    )) as AccountState | null;
    if (!account) {
      return;
    }

    const derivationPath = account.derivationPath.join('/');

    await Promise.all([
      this.#snapClient.setState(`derivationPaths.${derivationPath}`, null),
      this.#snapClient.setState(`accounts.${id}`, null),
    ]);
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
