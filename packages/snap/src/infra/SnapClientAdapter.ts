import type { JsonSLIP10Node } from '@metamask/key-tree';
import { SLIP10Node } from '@metamask/key-tree';
import { KeyringEvent } from '@metamask/keyring-api';
import { emitSnapKeyringEvent } from '@metamask/keyring-snap-sdk';
import type {
  AvailableCurrency,
  ComponentOrElement,
  CurrencyRate,
  Json,
  SnapsProvider,
} from '@metamask/snaps-sdk';

import type { BitcoinAccount, SnapClient, SnapState } from '../entities';
import { CurrencyUnit } from '../entities';
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
      (state as SnapState) ?? {
        accounts: { derivationPaths: {}, wallets: {}, inscriptions: {} },
      }
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
          return 'Bitcoin';
        case 'testnet':
        case 'testnet4':
          return 'Bitcoin Testnet';
        case 'signet':
          return 'Bitcoin Signet';
        case 'regtest':
          return 'Bitcoin Regtest';
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

  async createInterface(
    ui: ComponentOrElement,
    context: Record<string, Json>,
  ): Promise<string> {
    return await snap.request({
      method: 'snap_createInterface',
      params: {
        ui,
        context,
      },
    });
  }

  async updateInterface(
    id: string,
    ui: ComponentOrElement,
    context: Record<string, Json>,
  ): Promise<void> {
    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui,
        context,
      },
    });
  }

  async displayInterface<ResolveType>(id: string): Promise<ResolveType | null> {
    return (await snap.request({
      method: 'snap_dialog',
      params: {
        id,
      },
    })) as unknown as ResolveType;
  }

  async getInterfaceState<InterfaceStateType>(
    id: string,
    field: string,
  ): Promise<InterfaceStateType> {
    const result = await snap.request({
      method: 'snap_getInterfaceState',
      params: { id },
    });

    return result[field] as unknown as InterfaceStateType;
  }

  async resolveInterface(id: string, value: Json): Promise<void> {
    await snap.request({
      method: 'snap_resolveInterface',
      params: {
        id,
        value,
      },
    });
  }

  async getCurrencyRate(
    currency: CurrencyUnit,
  ): Promise<CurrencyRate | undefined> {
    // TODO: Remove when fix implemented: https://github.com/MetaMask/accounts-planning/issues/832
    if (currency !== CurrencyUnit.Bitcoin) {
      return undefined;
    }

    const rate = await snap.request({
      method: 'snap_getCurrencyRate',
      params: {
        currency: currency as unknown as AvailableCurrency,
      },
    });

    return rate ?? undefined;
  }
}
