import type { AddressType, Network } from 'bdk_wasm/bdk_wasm_bg';
import { stringify, parse } from 'superjson';
import { v4 as uuidv4 } from 'uuid';

import type { AccountRepository } from '.';
import { BdkAccountAdapter } from '../adapters';
import type { BitcoinAccount } from '../entities';
import type { SnapState } from './models';

export class BdkAccountRepository implements AccountRepository {
  async get(id: string): Promise<BitcoinAccount | null> {
    const state = await this.#getState();
    const walletData = this.#decodeWalletData(state, id);
    if (!walletData) {
      return null;
    }

    return BdkAccountAdapter.load(id, walletData);
  }

  async getByDerivationPath(
    derivationPath: string[],
  ): Promise<BitcoinAccount | null> {
    const derivationPathId = derivationPath.join('/');
    const state = await this.#getState();

    const id = state.accounts.derivationPaths[derivationPathId];
    if (!id) {
      return null;
    }

    const walletData = this.#decodeWalletData(state, id);
    if (!walletData) {
      return null;
    }

    return BdkAccountAdapter.load(id, walletData);
  }

  async list(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  async insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount> {
    const derivationPathId = derivationPath.join('/');

    const slip10 = await snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path: derivationPath,
        curve: 'secp256k1',
      },
    });

    const id = uuidv4();
    const account = BdkAccountAdapter.fromSLIP10(
      id,
      slip10,
      network,
      addressType,
    );
    account.revealNextAddress();

    const state = await this.#getState();
    state.accounts.derivationPaths[derivationPathId] = id;
    state.accounts.wallets[id] = stringify(account.takeStaged());
    await this.#setState(state);

    return account;
  }

  async update(id: string, wallet: BitcoinAccount): Promise<BitcoinAccount> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  #decodeWalletData(state: SnapState, id: string): any | null {
    const walletState = state.accounts.wallets[id];
    if (!walletState) {
      return null;
    }

    return parse(walletState);
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
