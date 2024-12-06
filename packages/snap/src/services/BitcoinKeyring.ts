import {
  type Keyring,
  type KeyringAccount,
  type KeyringRequest,
  type KeyringResponse,
  type Balance,
  type CaipAssetType,
  KeyringAccountData,
  emitSnapKeyringEvent,
  KeyringEvent,
} from '@metamask/keyring-api';

import { assert, enums, object, optional, StructError } from 'superstruct';

import { getProvider, logger } from '../utils';
import { Json } from '@metamask/utils';
import { AccountRepository } from '../store';
import { ConfigV2 } from '../config-v2';
import { Caip2AddressType, Caip2ChainId } from '../entities';
import { AddressType, Network } from 'bdk_wasm';

const CreateAccountOptionsStruct = object({
  network: optional(enums(Object.values(Caip2ChainId))),
  addressType: optional(enums(Object.values(Caip2AddressType))),
});

export const caip2ToNetwork: Record<Caip2ChainId, Network> = {
  [Caip2ChainId.Bitcoin]: Network.Bitcoin,
  [Caip2ChainId.Testnet]: Network.Testnet,
  [Caip2ChainId.Testnet4]: Network.Testnet4,
  [Caip2ChainId.Signet]: Network.Signet,
  [Caip2ChainId.Regtest]: Network.Regtest,
};

export const caip2ToAddressType: Record<Caip2AddressType, AddressType> = {
  [Caip2AddressType.P2pkh]: AddressType.P2pkh,
  [Caip2AddressType.P2sh]: AddressType.P2sh,
  [Caip2AddressType.P2wpkh]: AddressType.P2wpkh,
  [Caip2AddressType.P2tr]: AddressType.P2tr,
};

export class BitcoinKeyring implements Keyring {
  protected readonly _accounts: AccountRepository;

  constructor(accounts: AccountRepository) {
    this._accounts = accounts;
  }

  listAccounts(): Promise<KeyringAccount[]> {
    throw new Error('Method not implemented.');
  }
  getAccount(id: string): Promise<KeyringAccount | undefined> {
    throw new Error('Method not implemented.');
  }

  async createAccount(options?: Record<string, Json>): Promise<KeyringAccount> {
    logger.debug('Creating new Bitcoin account: %o', options);

    try {
      assert(options, CreateAccountOptionsStruct);

      const account = await this._accounts.insert(
        caip2ToNetwork[options.network ?? ConfigV2.accounts.defaultNetwork],
        caip2ToAddressType[
          options.addressType ?? ConfigV2.accounts.defaultAddressType
        ],
      );

      // TODO: Perform a full scan on account creation?

      const keyringAccount = {
        type: options.addressType,
        id: account.id,
        address: account.peekAddress(0).address,
      } as KeyringAccount;

      await emitSnapKeyringEvent(getProvider(), KeyringEvent.AccountCreated, {
        account: keyringAccount,
        accountNameSuggestion: account.suggestedName,
      });

      logger.info('Bitcoin account created successfully: %o', options);
      return keyringAccount;
    } catch (error) {
      logger.error('failed to create Bitcoin account: %o', error);

      if (error instanceof StructError) {
        throw new Error('Invalid params to create an account');
      }
      throw new Error(error);
    }
  }

  getAccountBalances?(
    id: string,
    assets: CaipAssetType[],
  ): Promise<Record<CaipAssetType, Balance>> {
    throw new Error('Method not implemented.');
  }
  filterAccountChains(id: string, chains: string[]): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  updateAccount(account: KeyringAccount): Promise<void> {
    throw new Error('Method not implemented.');
  }
  deleteAccount(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  exportAccount?(id: string): Promise<KeyringAccountData> {
    throw new Error('Method not implemented.');
  }
  listRequests?(): Promise<KeyringRequest[]> {
    throw new Error('Method not implemented.');
  }
  getRequest?(id: string): Promise<KeyringRequest | undefined> {
    throw new Error('Method not implemented.');
  }
  submitRequest(request: KeyringRequest): Promise<KeyringResponse> {
    throw new Error('Method not implemented.');
  }
  approveRequest?(id: string, data?: Record<string, Json>): Promise<void> {
    throw new Error('Method not implemented.');
  }
  rejectRequest?(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
