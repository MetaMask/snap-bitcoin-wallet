import { BtcMethod, BtcScopes } from '@metamask/keyring-api';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { BitcoinAccount, AccountsConfig } from '../entities';
import type { SnapClient } from '../entities/snap';
import type { AccountUseCases } from '../usecases/AccountUseCases';
import { Caip19Asset } from './caip19';
import { caip2ToNetwork, caip2ToAddressType, Caip2AddressType } from './caip2';
import { KeyringHandler, CreateAccountRequest } from './KeyringHandler';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

describe('KeyringHandler', () => {
  const mockAccounts = mock<AccountUseCases>();
  const mockSnapClient = mock<SnapClient>();
  const mockConfig: AccountsConfig = {
    index: 0,
    defaultNetwork: BtcScopes.Mainnet,
    defaultAddressType: Caip2AddressType.P2wpkh,
  };

  // TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
  /* eslint-disable @typescript-eslint/naming-convention */
  const mockAccount = {
    id: 'some-id',
    addressType: caip2ToAddressType[mockConfig.defaultAddressType],
    suggestedName: 'My Bitcoin Account',
    balance: { trusted_spendable: { to_btc: () => 1 } },
    network: 'bitcoin',
    nextUnusedAddress: () => ({ address: 'bc1qaddress...' }),
  } as unknown as BitcoinAccount;

  let handler: KeyringHandler;

  beforeEach(() => {
    handler = new KeyringHandler(mockAccounts, mockSnapClient, mockConfig);
  });

  describe('createAccount', () => {
    it('creates a new account with default config when no options are passed', async () => {
      mockAccounts.create.mockResolvedValue(mockAccount);
      const expectedKeyringAccount = {
        id: 'some-id',
        type: mockConfig.defaultAddressType,
        scopes: [BtcScopes.Mainnet],
        address: 'bc1qaddress...',
        options: {},
        methods: [BtcMethod.SendBitcoin],
      };

      const result = await handler.createAccount();
      expect(assert).toHaveBeenCalledWith({}, CreateAccountRequest);
      expect(mockAccounts.create).toHaveBeenCalledWith(
        caip2ToNetwork[mockConfig.defaultNetwork],
        caip2ToAddressType[mockConfig.defaultAddressType],
      );
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalledWith(
        expectedKeyringAccount,
        mockAccount.suggestedName,
      );
      expect(result).toStrictEqual(expectedKeyringAccount);
    });

    it('respects provided provided scope and addressType', async () => {
      mockAccounts.create.mockResolvedValue(mockAccount);

      const options = {
        scope: BtcScopes.Signet,
        addressType: Caip2AddressType.P2pkh,
      };
      await handler.createAccount(options);

      expect(assert).toHaveBeenCalledWith(options, CreateAccountRequest);
      expect(mockAccounts.create).toHaveBeenCalledWith(
        caip2ToNetwork[BtcScopes.Signet],
        caip2ToAddressType[Caip2AddressType.P2pkh],
      );
    });

    it('propagates errors from createAccount', async () => {
      const error = new Error();
      mockAccounts.create.mockRejectedValue(error);

      await expect(handler.createAccount()).rejects.toThrow(error);
      expect(mockAccounts.create).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).not.toHaveBeenCalled();
    });

    it('propagates errors from emitSnapKeyringEvent', async () => {
      const error = new Error();
      mockAccounts.create.mockResolvedValue(mockAccount);
      mockSnapClient.emitAccountCreatedEvent.mockRejectedValue(error);

      await expect(handler.createAccount()).rejects.toThrow(error);
      expect(mockAccounts.create).toHaveBeenCalled();
      expect(mockSnapClient.emitAccountCreatedEvent).toHaveBeenCalled();
    });
  });

  describe('getAccountBalances', () => {
    it('synchronizes the account before getting the balance', async () => {
      mockAccounts.synchronize.mockResolvedValue(mockAccount);
      const expectedResponse = {
        [Caip19Asset.Bitcoin]: {
          amount: '1',
          unit: 'BTC',
        },
      };

      const result = await handler.getAccountBalances(mockAccount.id, []);
      expect(mockAccounts.synchronize).toHaveBeenCalledWith(mockAccount.id);
      expect(result).toStrictEqual(expectedResponse);
    });

    it('ignores the assets list', async () => {
      mockAccounts.synchronize.mockResolvedValue(mockAccount);
      const expectedResponse = {
        [Caip19Asset.Bitcoin]: {
          amount: '1',
          unit: 'BTC',
        },
      };

      const result = await handler.getAccountBalances(mockAccount.id, [
        'ignored-asset',
      ]);
      expect(mockAccounts.synchronize).toHaveBeenCalledWith(mockAccount.id);
      expect(result).toStrictEqual(expectedResponse);
    });

    it('propagates errors from synchronize', async () => {
      const error = new Error();
      mockAccounts.synchronize.mockRejectedValue(error);

      await expect(
        handler.getAccountBalances(mockAccount.id, []),
      ).rejects.toThrow(error);
      expect(mockAccounts.synchronize).toHaveBeenCalled();
    });
  });

  describe('getAccount', () => {
    it('gets account', async () => {
      mockAccounts.get.mockResolvedValue(mockAccount);
      const expectedKeyringAccount = {
        id: 'some-id',
        type: mockConfig.defaultAddressType,
        scopes: [BtcScopes.Mainnet],
        address: 'bc1qaddress...',
        options: {},
        methods: [BtcMethod.SendBitcoin],
      };

      const result = await handler.getAccount('some-id');
      expect(mockAccounts.get).toHaveBeenCalledWith('some-id');
      expect(result).toStrictEqual(expectedKeyringAccount);
    });

    it('propagates errors from get', async () => {
      const error = new Error();
      mockAccounts.get.mockRejectedValue(error);

      await expect(handler.getAccount('some-id')).rejects.toThrow(error);
      expect(mockAccounts.get).toHaveBeenCalled();
    });
  });

  describe('unimplemented methods', () => {
    const errMsg = 'Method not implemented.';

    it('listAccounts should throw', async () => {
      await expect(handler.listAccounts()).rejects.toThrow(errMsg);
    });

    it('filterAccountChains should throw', async () => {
      await expect(handler.filterAccountChains('some-id', [])).rejects.toThrow(
        errMsg,
      );
    });

    it('updateAccount should throw', async () => {
      await expect(handler.updateAccount({} as any)).rejects.toThrow(errMsg);
    });

    it('deleteAccount should throw', async () => {
      await expect(handler.deleteAccount('some-id')).rejects.toThrow(errMsg);
    });

    it('exportAccount should throw', async () => {
      await expect(handler.exportAccount('some-id')).rejects.toThrow(errMsg);
    });

    it('listRequests should throw', async () => {
      await expect(handler.listRequests()).rejects.toThrow(errMsg);
    });

    it('getRequest should throw', async () => {
      await expect(handler.getRequest('some-id')).rejects.toThrow(errMsg);
    });

    it('submitRequest should throw', async () => {
      await expect(handler.submitRequest({} as any)).rejects.toThrow(errMsg);
    });

    it('approveRequest should throw', async () => {
      await expect(handler.approveRequest({} as any)).rejects.toThrow(errMsg);
    });

    it('rejectRequest should throw', async () => {
      await expect(handler.rejectRequest({} as any)).rejects.toThrow(errMsg);
    });
  });
});
