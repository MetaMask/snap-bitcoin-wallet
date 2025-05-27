import type { WalletTx } from '@metamask/bitcoindevkit';
import type { JsonSLIP10Node } from '@metamask/key-tree';
import { SLIP10Node } from '@metamask/key-tree';
import { KeyringEvent } from '@metamask/keyring-api';
import { emitSnapKeyringEvent } from '@metamask/keyring-snap-sdk';
import type {
  GetInterfaceContextResult,
  GetInterfaceStateResult,
  Json,
  ComponentOrElement,
  GetPreferencesResult,
} from '@metamask/snaps-sdk';

import type { BitcoinAccount, SnapClient } from '../entities';
import { networkToCurrencyUnit } from '../entities';
import { networkToCaip19 } from '../handlers';
import {
  mapToKeyringAccount,
  mapToTransaction,
  addressTypeToName,
  networkToName,
} from '../handlers/mappings';

export class SnapClientAdapter implements SnapClient {
  readonly #encrypt: boolean;

  constructor(encrypt = false) {
    this.#encrypt = encrypt;
  }

  async getState(key: string): Promise<Json | null> {
    return snap.request({
      method: 'snap_getState',
      params: {
        key,
        encrypted: this.#encrypt,
      },
    });
  }

  async setState(key: string, newState: Json | null): Promise<void> {
    await snap.request({
      method: 'snap_setState',
      params: {
        key,
        value: newState,
        encrypted: this.#encrypt,
      },
    });
  }

  async removeState(key: string): Promise<void> {
    await this.setState(key, null);
  }

  async getPrivateEntropy(derivationPath: string[]): Promise<JsonSLIP10Node> {
    const source = derivationPath[0] === 'm' ? undefined : derivationPath[0];
    const path = ['m', ...derivationPath.slice(1)];

    return snap.request({
      method: 'snap_getBip32Entropy',
      params: {
        path,
        curve: 'secp256k1',
        source,
      },
    });
  }

  async getPublicEntropy(derivationPath: string[]): Promise<SLIP10Node> {
    const slip10 = await this.getPrivateEntropy(derivationPath);
    return (await SLIP10Node.fromJSON(slip10)).neuter();
  }

  async emitAccountCreatedEvent(
    account: BitcoinAccount,
    correlationId?: string,
  ): Promise<void> {
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountCreated, {
      account: mapToKeyringAccount(account),
      accountNameSuggestion: `${networkToName[account.network]} ${
        addressTypeToName[account.addressType]
      }`,
      displayConfirmation: false,
      displayAccountNameSuggestion: false,
      ...(correlationId ? { metamask: { correlationId } } : {}),
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

  async emitAccountTransactionsUpdatedEvent(
    account: BitcoinAccount,
    txs: WalletTx[],
  ): Promise<void> {
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountTransactionsUpdated, {
      transactions: {
        [account.id]: txs.map((tx) => mapToTransaction(account, tx)),
      },
    });
  }

  async createInterface(
    ui: ComponentOrElement,
    context: Record<string, Json>,
  ): Promise<string> {
    return snap.request({
      method: 'snap_createInterface',
      params: { ui, context },
    });
  }

  async updateInterface(
    id: string,
    ui: ComponentOrElement,
    context: Record<string, Json>,
  ): Promise<void> {
    await snap.request({
      method: 'snap_updateInterface',
      params: { id, ui, context },
    });
  }

  async displayInterface<ResolveType>(id: string): Promise<ResolveType | null> {
    return (await snap.request({
      method: 'snap_dialog',
      params: { id },
    })) as unknown as ResolveType;
  }

  async getInterfaceState(id: string): Promise<GetInterfaceStateResult> {
    return snap.request({
      method: 'snap_getInterfaceState',
      params: { id },
    });
  }

  async getInterfaceContext(id: string): Promise<GetInterfaceContextResult> {
    return snap.request({
      method: 'snap_getInterfaceContext',
      params: { id },
    });
  }

  async resolveInterface(id: string, value: Json): Promise<void> {
    await snap.request({
      method: 'snap_resolveInterface',
      params: { id, value },
    });
  }

  async scheduleBackgroundEvent(
    interval: string,
    method: string,
    interfaceId: string,
  ): Promise<string> {
    return snap.request({
      method: 'snap_scheduleBackgroundEvent',
      params: {
        duration: interval,
        request: {
          method,
          params: { interfaceId },
        },
      },
    });
  }

  async cancelBackgroundEvent(id: string): Promise<void> {
    await snap.request({
      method: 'snap_cancelBackgroundEvent',
      params: {
        id,
      },
    });
  }

  async getPreferences(): Promise<GetPreferencesResult> {
    return snap.request({
      method: 'snap_getPreferences',
    });
  }
}
