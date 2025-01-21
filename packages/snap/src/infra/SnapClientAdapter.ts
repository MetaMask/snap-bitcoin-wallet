import type { JsonSLIP10Node } from '@metamask/key-tree';
import { SLIP10Node } from '@metamask/key-tree';
import { KeyringEvent } from '@metamask/keyring-api';
import { emitSnapKeyringEvent } from '@metamask/keyring-snap-sdk';
import type { SnapsProvider } from '@metamask/snaps-sdk';

import type { BitcoinAccount } from '../entities';
import type { SnapClient, SnapState } from '../entities/snap';
import { snapToKeyringAccount } from '../handlers/keyring-account';

export class SnapClientAdapter implements SnapClient {
  readonly #encrypt: boolean;

  constructor(encrypt = false) {
    this.#encrypt = encrypt;
  }

  get provider(): SnapsProvider {
    return snap;
  }

  async get(): Promise<SnapState> {
    const state = await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'get',
        encrypted: this.#encrypt,
      },
    });

    return (
      (state as SnapState) ?? { accounts: { derivationPaths: {}, wallets: {} } }
    );
  }

  async set(newState: SnapState): Promise<void> {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState,
        encrypted: this.#encrypt,
      },
    });
  }

  async getPrivateEntropy(derivationPath: string[]): Promise<JsonSLIP10Node> {
    return await snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path: derivationPath,
        curve: 'secp256k1',
      },
    });
  }

  async getPublicEntropy(derivationPath: string[]): Promise<SLIP10Node> {
    const slip10 = await this.getPrivateEntropy(derivationPath);
    return (await SLIP10Node.fromJSON(slip10)).neuter();
  }

  async emitAccountCreatedEvent(account: BitcoinAccount): Promise<void> {
    const suggestedName = () => {
      switch (account.network) {
        case 'bitcoin':
          return 'Bitcoin Account';
        case 'testnet':
          return 'Bitcoin Testnet Account';
        default:
          // Leave it blank to fallback to auto-suggested name on the extension side
          return '';
      }
    };

    return emitSnapKeyringEvent(snap, KeyringEvent.AccountCreated, {
      account: snapToKeyringAccount(account),
      accountNameSuggestion: suggestedName(),
    });
  }

  async emitAccountDeletedEvent(id: string): Promise<void> {
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountDeleted, {
      id,
    });
  }
}
