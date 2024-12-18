import {
  BtcMethod,
  KeyringEvent,
  emitSnapKeyringEvent,
} from '@metamask/keyring-api';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { BitcoinAccount, AccountsConfig } from '../entities';
import type { AccountUseCases } from '../usecases/AccountUseCases';
import { getProvider } from '../utils';
import { Caip19Asset } from './caip19';
import {
  caip2ToNetwork,
  caip2ToAddressType,
  Caip2ChainId,
  Caip2AddressType,
} from './caip2';
import { KeyringHandler, CreateAccountRequest } from './KeyringHandler';

jest.mock('../utils', () => ({
  getProvider: jest.fn(),
}));

jest.mock('@metamask/keyring-api', () => ({
  ...jest.requireActual('@metamask/keyring-api'),
  emitSnapKeyringEvent: jest.fn(),
}));

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

describe('KeyringHandler', () => {
  const mockAccounts = mock<AccountUseCases>();
  const mockConfig: AccountsConfig = {
    index: 0,
    defaultNetwork: Caip2ChainId.Bitcoin,
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
    handler = new KeyringHandler(mockAccounts, mockConfig);
  });

  describe('createAccount', () => {
    beforeEach(() => {
      (getProvider as jest.Mock).mockReturnValue({});
      (emitSnapKeyringEvent as jest.Mock).mockResolvedValue(undefined);
    });

    it('should create a new account with default config when no options are passed', async () => {
      mockAccounts.create.mockResolvedValue(mockAccount);
      const expectedKeyringAccount = {
        id: 'some-id',
        type: mockConfig.defaultAddressType,
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
      expect(emitSnapKeyringEvent).toHaveBeenCalledWith(
        {},
        KeyringEvent.AccountCreated,
        {
          account: expectedKeyringAccount,
          accountNameSuggestion: mockAccount.suggestedName,
        },
      );
      expect(result).toStrictEqual(expectedKeyringAccount);
    });

    it('should respect provided scope and addressType', async () => {
      mockAccounts.create.mockResolvedValue(mockAccount);

      const options = {
        scope: Caip2ChainId.Signet,
        addressType: Caip2AddressType.P2pkh,
      };
      await handler.createAccount(options);

      expect(assert).toHaveBeenCalledWith(options, CreateAccountRequest);
      expect(mockAccounts.create).toHaveBeenCalledWith(
        caip2ToNetwork[Caip2ChainId.Signet],
        caip2ToAddressType[Caip2AddressType.P2pkh],
      );
    });

    it('should propagate errors from createAccount', async () => {
      const error = new Error();
      mockAccounts.create.mockRejectedValue(error);

      await expect(handler.createAccount()).rejects.toThrow(error);
      expect(mockAccounts.create).toHaveBeenCalled();
      expect(emitSnapKeyringEvent).not.toHaveBeenCalled();
    });

    it('should propagate errors from emitSnapKeyringEvent', async () => {
      const error = new Error();
      mockAccounts.create.mockResolvedValue(mockAccount);
      (emitSnapKeyringEvent as jest.Mock).mockRejectedValue(error);

      await expect(handler.createAccount()).rejects.toThrow(error);
      expect(mockAccounts.create).toHaveBeenCalled();
      expect(emitSnapKeyringEvent).toHaveBeenCalled();
    });
  });

  describe('getAccountBalances', () => {
    it('should synchronize the account before getting the balance', async () => {
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

    it('should ignore the assets list', async () => {
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

    it('should propagate errors from synchronize', async () => {
      const error = new Error();
      mockAccounts.synchronize.mockRejectedValue(error);

      await expect(
        handler.getAccountBalances(mockAccount.id, []),
      ).rejects.toThrow(error);
      expect(mockAccounts.synchronize).toHaveBeenCalled();
    });
  });

  describe('getAccount', () => {
    it('should get account', async () => {
      mockAccounts.get.mockResolvedValue(mockAccount);
      const expectedKeyringAccount = {
        id: 'some-id',
        type: mockConfig.defaultAddressType,
        address: 'bc1qaddress...',
        options: {},
        methods: [BtcMethod.SendBitcoin],
      };

      const result = await handler.getAccount('some-id');
      expect(mockAccounts.get).toHaveBeenCalledWith('some-id');
      expect(result).toStrictEqual(expectedKeyringAccount);
    });

    it('should propagate errors from get', async () => {
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
