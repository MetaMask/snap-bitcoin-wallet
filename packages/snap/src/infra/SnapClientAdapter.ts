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
import { CurrencyUnit, networkToCurrencyUnit } from '../entities';
import { networkToCaip19 } from '../handlers/caip19';
import { snapToKeyringAccount } from '../handlers/keyring-account';
import { addressTypeToName, networkToName } from '../handlers/mapping';

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
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountCreated, {
      account: snapToKeyringAccount(account),
      accountNameSuggestion: `${networkToName[account.network]} ${
        addressTypeToName[account.addressType]
      }`,
    });
  }

  async emitAccountDeletedEvent(id: string): Promise<void> {
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountDeleted, {
      id,
    });
  }

  async emitAccountBalancesUpdatedEvent(
    account: BitcoinAccount,
  ): Promise<void> {
    const balance = account.balance.trusted_spendable.to_btc().toString();
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountBalancesUpdated, {
      balances: {
        [account.id]: {
          [networkToCaip19[account.network]]: {
            amount: balance,
            unit: networkToCurrencyUnit[account.network],
          },
        },
      },
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
