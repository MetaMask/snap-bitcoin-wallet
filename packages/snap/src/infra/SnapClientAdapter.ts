import type { WalletTx } from '@metamask/bitcoindevkit';
import type { JsonSLIP10Node } from '@metamask/key-tree';
import { SLIP10Node } from '@metamask/key-tree';
import { KeyringEvent } from '@metamask/keyring-api';
import { emitSnapKeyringEvent } from '@metamask/keyring-snap-sdk';
import type {
  GetClientStatusResult,
  ComponentOrElement,
  GetInterfaceContextResult,
  GetInterfaceStateResult,
  GetPreferencesResult,
  Json,
} from '@metamask/snaps-sdk';
import { DialogType } from '@metamask/snaps-sdk';

import type { BaseError, BitcoinAccount, SnapClient } from '../entities';
import {
  TrackingSnapEvent,
  networkToCurrencyUnit,
  AssertionError,
} from '../entities';
import {
  addressTypeToCaip,
  networkToCaip19,
  networkToScope,
} from '../handlers';
import { mapToKeyringAccount, mapToTransaction } from '../handlers/mappings';

export class SnapClientAdapter implements SnapClient {
  readonly #encrypt: boolean;

  constructor(encrypt = false) {
    this.#encrypt = encrypt;
  }

  async getState(key?: string): Promise<Json | null> {
    return snap.request({
      method: 'snap_getState',
      params: {
        key,
        encrypted: this.#encrypt,
      },
    });
  }

  async setState(key?: string, newState: Json = {}): Promise<void> {
    await snap.request({
      method: 'snap_setState',
      params: {
        key,
        value: newState,
        encrypted: this.#encrypt,
      },
    });
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
    accountName?: string,
  ): Promise<void> {
    return emitSnapKeyringEvent(snap, KeyringEvent.AccountCreated, {
      account: mapToKeyringAccount(account),
      accountNameSuggestion: accountName,
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

  async displayConfirmation<ResolveType>(
    id: string,
  ): Promise<ResolveType | null> {
    return (await snap.request({
      method: 'snap_dialog',
      params: { type: DialogType.Confirmation, id },
    })) as unknown as ResolveType;
  }

  async displayUserPrompt<ResolveType>(
    id: string,
  ): Promise<ResolveType | null> {
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

  async getClientStatus(): Promise<GetClientStatusResult> {
    return snap.request({
      method: 'snap_getClientStatus',
    });
  }

  async emitTrackingEvent(
    eventType: TrackingSnapEvent,
    account: BitcoinAccount,
    tx: WalletTx,
    origin: string,
  ): Promise<void> {
    const createMessage = (): string => {
      switch (eventType) {
        case TrackingSnapEvent.TransactionFinalized:
          return 'Snap transaction finalized';
        case TrackingSnapEvent.TransactionSubmitted:
          return 'Snap transaction submitted';
        case TrackingSnapEvent.TransactionReorged:
          return 'Snap transaction reorged';
        case TrackingSnapEvent.TransactionReceived:
          return 'Snap transaction received';
        default:
          throw new AssertionError(`Unhandled tracking event type`, {
            eventType,
            origin,
          });
      }
    };

    /* eslint-disable @typescript-eslint/naming-convention */
    await snap.request({
      method: 'snap_trackEvent',
      params: {
        event: {
          event: eventType,
          properties: {
            origin,
            message: createMessage(),
            chain_id_caip: networkToScope[account.network],
            account_type: addressTypeToCaip[account.addressType],
            tx_id: tx.txid.toString(),
          },
        },
      },
    });
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  async emitTrackingError(error: BaseError): Promise<void> {
    await snap.request({
      method: 'snap_trackError',
      params: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack ?? null,
          cause:
            error.cause && error.cause instanceof Error
              ? {
                  cause: null,
                  message: error.cause.message,
                  name: error.cause.name,
                  stack: error.cause.stack ?? null,
                }
              : null,
        },
      },
    });
  }
}
