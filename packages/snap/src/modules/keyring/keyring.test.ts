import { generateAccounts } from '../../../test/utils';
import { Network } from '../bitcoin/config';
import { Chain, Config } from '../config';
import { BtcKeyringError } from './exceptions';
import { BtcKeyring } from './keyring';
import { KeyringStateManager } from './state';
import type { IAccountMgr } from './types';

jest.mock('../logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('BtcKeyring', () => {
  const createMockAccountMgr = () => {
    const unlockSpy = jest.fn();
    class AccountMgr implements IAccountMgr {
      unlock = unlockSpy;
    }
    return {
      instance: new AccountMgr(),
      unlockSpy,
    };
  };

  const createMockStateMgr = () => {
    const listAccountsSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'listAccounts',
    );
    const saveAccountSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'saveAccount',
    );
    const removeAccountsSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'removeAccounts',
    );
    const getAccountSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'getAccount',
    );
    const getAccountByAddressSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'getAccountByAddress',
    );

    return {
      instance: new KeyringStateManager(),
      listAccountsSpy,
      saveAccountSpy,
      removeAccountsSpy,
      getAccountSpy,
      getAccountByAddressSpy,
    };
  };

  const createMockKeyring = (
    accMgr: IAccountMgr,
    stateMgr: KeyringStateManager,
  ) => {
    return {
      instance: new BtcKeyring(accMgr, stateMgr, {
        defaultIndex: 0,
      }),
    };
  };

  describe('createAccount', () => {
    it('creates account', async () => {
      const { instance: accMgr, unlockSpy } = createMockAccountMgr();
      const {
        instance: stateMgr,
        saveAccountSpy,
        getAccountByAddressSpy,
      } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];

      getAccountByAddressSpy.mockResolvedValue(null);

      unlockSpy.mockResolvedValue({
        address: account.address,
        hdPath: account.options.hdPath,
        index: account.options.index,
        type: account.options.type,
      });

      await keyring.createAccount();

      expect(unlockSpy).toHaveBeenCalledWith(
        Config.account[Chain.Bitcoin].defaultAccountIndex,
      );
      expect(saveAccountSpy).toHaveBeenCalledWith({
        type: account.type,
        id: expect.any(String),
        address: account.address,
        options: {
          hdPath: account.options.hdPath,
          index: account.options.index,
          type: account.options.type,
        },
        methods: ['chain_getBalances'],
      });
    });

    it('creates account with options', async () => {
      const { instance: accMgr, unlockSpy } = createMockAccountMgr();
      const {
        instance: stateMgr,
        saveAccountSpy,
        getAccountByAddressSpy,
      } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];

      getAccountByAddressSpy.mockResolvedValue(null);

      unlockSpy.mockResolvedValue({
        address: account.address,
        hdPath: account.options.hdPath,
        index: account.options.index,
        type: account.options.type,
      });

      await keyring.createAccount({ index: 1 });

      expect(unlockSpy).toHaveBeenCalledWith(1);
      expect(saveAccountSpy).toHaveBeenCalledWith({
        type: account.type,
        id: expect.any(String),
        address: account.address,
        options: {
          hdPath: account.options.hdPath,
          index: account.options.index,
          type: account.options.type,
        },
        methods: ['chain_getBalances'],
      });
    });

    it('does not create account if the account is exist', async () => {
      const { instance: accMgr, unlockSpy } = createMockAccountMgr();
      const {
        instance: stateMgr,
        saveAccountSpy,
        getAccountByAddressSpy,
      } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];

      getAccountByAddressSpy.mockResolvedValue(account);

      unlockSpy.mockResolvedValue({
        address: account.address,
        hdPath: account.options.hdPath,
        index: account.options.index,
        type: account.options.type,
      });

      const acc = await keyring.createAccount();

      expect(unlockSpy).toHaveBeenCalledWith(0);
      expect(saveAccountSpy).toHaveBeenCalledTimes(0);
      expect(acc).toStrictEqual(account);
    });

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: accMgr, unlockSpy } = createMockAccountMgr();
      const { instance: stateMgr, getAccountByAddressSpy } =
        createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      getAccountByAddressSpy.mockResolvedValue(null);
      unlockSpy.mockRejectedValue(new Error('error'));

      await expect(keyring.createAccount()).rejects.toThrow(BtcKeyringError);
    });
  });

  describe('filterAccountChains', () => {
    it('throws `Method not implemented` error', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];

      await expect(
        keyring.filterAccountChains(account.id, [Network.Testnet]),
      ).rejects.toThrow('Method not implemented.');
    });
  });

  describe('submitRequest', () => {
    it('throws Method not implemented error', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];

      await expect(
        keyring.submitRequest({
          id: account.id,
          scope: Network.Testnet,
          account: account.address,
          request: {
            method: 'signMessage',
          },
        }),
      ).rejects.toThrow('Method not implemented.');
    });
  });

  describe('listAccounts', () => {
    it('returns result', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, listAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const accounts = generateAccounts(10);
      listAccountsSpy.mockResolvedValue(accounts);

      const result = await keyring.listAccounts();

      expect(result).toStrictEqual(accounts);
      expect(listAccountsSpy).toHaveBeenCalledTimes(1);
    });

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, listAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      listAccountsSpy.mockRejectedValue(new Error('error'));

      await expect(keyring.listAccounts()).rejects.toThrow(BtcKeyringError);
    });
  });

  describe('getAccount', () => {
    it('returns result', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, getAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];
      getAccountSpy.mockResolvedValue(account);

      const result = await keyring.getAccount(account.id);

      expect(result).toStrictEqual(account);
      expect(getAccountSpy).toHaveBeenCalledTimes(1);
    });

    it('returns undefined if the account is not exist', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, getAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];
      getAccountSpy.mockResolvedValue(null);

      const result = await keyring.getAccount(account.id);

      expect(result).toBeUndefined();
      expect(getAccountSpy).toHaveBeenCalledTimes(1);
    });

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, getAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      getAccountSpy.mockRejectedValue(new Error('error'));
      const accounts = generateAccounts(1);

      await expect(keyring.getAccount(accounts[0].id)).rejects.toThrow(
        BtcKeyringError,
      );
    });
  });

  describe('updateAccount', () => {
    it('updates account', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, saveAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];
      saveAccountSpy.mockReturnThis();

      await keyring.updateAccount(account);

      expect(saveAccountSpy).toHaveBeenCalledWith(account);
    });

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, saveAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      saveAccountSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(keyring.updateAccount(account)).rejects.toThrow(
        BtcKeyringError,
      );
    });
  });

  describe('deleteAccount', () => {
    it('remove account', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, removeAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      const account = generateAccounts(1)[0];
      removeAccountsSpy.mockReturnThis();

      await keyring.deleteAccount(account.id);

      expect(removeAccountsSpy).toHaveBeenCalledWith([account.id]);
    });

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: accMgr } = createMockAccountMgr();
      const { instance: stateMgr, removeAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(accMgr, stateMgr);
      removeAccountsSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(keyring.deleteAccount(account.id)).rejects.toThrow(
        BtcKeyringError,
      );
    });
  });
});
