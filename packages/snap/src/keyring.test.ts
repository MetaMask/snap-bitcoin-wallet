import type { KeyringAccount } from '@metamask/keyring-api';
import { MethodNotFoundError } from '@metamask/snaps-sdk';
import { v4 as uuidv4 } from 'uuid';

import { generateAccounts } from '../test/utils';
import { ScriptType } from './bitcoin/constants';
import { BtcAccount } from './bitcoin/wallet';
import { Config } from './config';
import { Caip2Asset, Caip2ChainId } from './constants';
import { Factory } from './factory';
import { BtcKeyring } from './keyring';
import * as getBalanceRpc from './rpcs/get-balances';
import * as sendManyRpc from './rpcs/sendmany';
import { KeyringStateManager } from './stateManagement';
import type { IWallet } from './wallet';

jest.mock('./utils/logger');
jest.mock('./utils/snap');

jest.mock('@metamask/keyring-api', () => ({
  ...jest.requireActual('@metamask/keyring-api'),
  emitSnapKeyringEvent: jest.fn(),
}));

describe('BtcKeyring', () => {
  const createMockWallet = () => {
    const unlockSpy = jest.fn();
    class Wallet implements IWallet {
      unlock = unlockSpy;

      signTransaction = jest.fn();

      createTransaction = jest.fn();
    }
    jest
      .spyOn(Factory, 'createWallet')
      .mockImplementation()
      .mockReturnValue(new Wallet());
    return {
      unlockSpy,
    };
  };

  const createMockStateMgr = () => {
    const listAccountsSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'listAccounts',
    );
    const addWalletSpy = jest.spyOn(KeyringStateManager.prototype, 'addWallet');
    const updateAccountSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'updateAccount',
    );
    const removeAccountsSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'removeAccounts',
    );
    const getAccountSpy = jest.spyOn(
      KeyringStateManager.prototype,
      'getAccount',
    );
    const getWalletSpy = jest.spyOn(KeyringStateManager.prototype, 'getWallet');

    return {
      instance: new KeyringStateManager(),
      listAccountsSpy,
      addWalletSpy,
      removeAccountsSpy,
      getAccountSpy,
      updateAccountSpy,
      getWalletSpy,
    };
  };

  const createMockKeyring = (stateMgr: KeyringStateManager) => {
    const sendManySpy = jest.spyOn(sendManyRpc, 'sendMany');
    const getBalanceRpcSpy = jest.spyOn(getBalanceRpc, 'getBalances');
    return {
      instance: new BtcKeyring(stateMgr, {
        defaultIndex: 0,
        multiAccount: false,
      }),
      sendManySpy,
      getBalanceRpcSpy,
    };
  };

  const getHdPath = (index: number) => {
    return [`m`, `0'`, `0`, `${index}`].join('/');
  };

  const createSender = async (caip2ChainId: string) => {
    const wallet = Factory.createWallet(caip2ChainId);
    const sender = await wallet.unlock(0, ScriptType.P2wpkh);

    const keyringAccount = {
      type: sender.type,
      id: uuidv4(),
      address: sender.address,
      options: {
        scope: caip2ChainId,
        index: sender.index,
      },
      methods: ['btc_sendmany'],
    };
    return {
      sender,
      keyringAccount,
    };
  };

  describe('createAccount', () => {
    it('creates account', async () => {
      const { unlockSpy } = createMockWallet();
      const { instance: stateMgr, addWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const scope = Caip2ChainId.Testnet;
      const account = generateAccounts(1)[0];

      unlockSpy.mockResolvedValue({
        address: account.address,
        hdPath: getHdPath(account.options.index),
        index: account.options.index,
        type: account.type,
      });

      await keyring.createAccount({
        scope,
      });

      expect(unlockSpy).toHaveBeenCalledWith(
        Config.wallet.defaultAccountIndex,
        Config.wallet.defaultAccountType,
      );
      expect(addWalletSpy).toHaveBeenCalledWith({
        account: {
          type: account.type,
          id: expect.any(String),
          address: account.address,
          options: {
            scope,
            index: account.options.index,
          },
          methods: account.methods,
        },
        hdPath: getHdPath(account.options.index),
        index: account.options.index,
        scope,
      });
    });

    it('throws Error if an error catched', async () => {
      const { unlockSpy } = createMockWallet();
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      unlockSpy.mockRejectedValue(new Error('error'));
      const scope = Caip2ChainId.Testnet;

      await expect(
        keyring.createAccount({
          scope,
        }),
      ).rejects.toThrow(Error);
    });

    it('throws `Invalid params to create an account` if the create options is invalid', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);

      await expect(
        keyring.createAccount({
          scope: 'invalid',
        }),
      ).rejects.toThrow(`Invalid params to create an account`);
    });
  });

  describe('filterAccountChains', () => {
    it('throws `Method not implemented` error', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];

      await expect(
        keyring.filterAccountChains(account.id, [Caip2ChainId.Testnet]),
      ).rejects.toThrow('Method not implemented.');
    });
  });

  describe('listAccounts', () => {
    it('returns result', async () => {
      const { instance: stateMgr, listAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const accounts = generateAccounts(10);
      listAccountsSpy.mockResolvedValue(accounts);

      const result = await keyring.listAccounts();

      expect(result).toStrictEqual(accounts);
      expect(listAccountsSpy).toHaveBeenCalledTimes(1);
    });

    it('throws Error if an error catched', async () => {
      const { instance: stateMgr, listAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      listAccountsSpy.mockRejectedValue(new Error('error'));

      await expect(keyring.listAccounts()).rejects.toThrow(Error);
    });
  });

  describe('getAccount', () => {
    it('returns result', async () => {
      const { instance: stateMgr, getAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];
      getAccountSpy.mockResolvedValue(account);

      const result = await keyring.getAccount(account.id);

      expect(result).toStrictEqual(account);
      expect(getAccountSpy).toHaveBeenCalledTimes(1);
    });

    it('returns undefined if the account is not exist', async () => {
      const { instance: stateMgr, getAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];
      getAccountSpy.mockResolvedValue(null);

      const result = await keyring.getAccount(account.id);

      expect(result).toBeUndefined();
      expect(getAccountSpy).toHaveBeenCalledTimes(1);
    });

    it('throws Error if an error catched', async () => {
      const { instance: stateMgr, getAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      getAccountSpy.mockRejectedValue(new Error('error'));
      const accounts = generateAccounts(1);

      await expect(keyring.getAccount(accounts[0].id)).rejects.toThrow(Error);
    });
  });

  describe('updateAccount', () => {
    it('updates account', async () => {
      const { instance: stateMgr, updateAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];
      updateAccountSpy.mockReturnThis();

      await keyring.updateAccount(account);

      expect(updateAccountSpy).toHaveBeenCalledWith(account);
    });

    it('throws Error if an error catched', async () => {
      const { instance: stateMgr, updateAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      updateAccountSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(keyring.updateAccount(account)).rejects.toThrow(Error);
    });
  });

  describe('deleteAccount', () => {
    it('remove account', async () => {
      const { instance: stateMgr, removeAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];
      removeAccountsSpy.mockReturnThis();

      await keyring.deleteAccount(account.id);

      expect(removeAccountsSpy).toHaveBeenCalledWith([account.id]);
    });

    it('throws Error if an error catched', async () => {
      const { instance: stateMgr, removeAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      removeAccountsSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(keyring.deleteAccount(account.id)).rejects.toThrow(Error);
    });
  });

  describe('submitRequest', () => {
    it('calls SnapRpcHandler if the method support', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring, sendManySpy } = createMockKeyring(stateMgr);
      const { sender, keyringAccount } = await createSender(caip2ChainId);
      getWalletSpy.mockResolvedValue({
        account: keyringAccount as unknown as KeyringAccount,
        index: sender.index,
        scope: keyringAccount.options.scope,
        hdPath: sender.hdPath,
      });
      sendManySpy.mockResolvedValue({
        txId: 'txid',
      });

      const params = {
        scope: caip2ChainId,
        amounts: {
          bc1qrp0yzgkf8rawkuvdlhnjfj2fnjwm0m8727kgah: '0.01',
          bc1qf5n2h6mgelkls4497pkpemew55xpew90td2qae: '0.01',
        },
        comment: 'testing',
        subtractFeeFrom: ['bc1qrp0yzgkf8rawkuvdlhnjfj2fnjwm0m8727kgah'],
        replaceable: false,
      };

      await keyring.submitRequest({
        id: keyringAccount.id,
        scope: Caip2ChainId.Testnet,
        account: keyringAccount.address,
        request: {
          method: 'btc_sendmany',
          params,
        },
      });

      expect(sendManySpy).toHaveBeenCalledWith(expect.any(BtcAccount), params);
    });

    it('throws `Account not found` error if the account address not found', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];

      await expect(
        keyring.submitRequest({
          id: account.id,
          scope: Caip2ChainId.Testnet,
          account: account.address,
          request: {
            method: 'btc_sendmany',
          },
        }),
      ).rejects.toThrow('Account not found');
    });

    it("throws `Account's scope does not match with the request's scope` error if given scope is not match with the account", async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const { sender, keyringAccount } = await createSender(caip2ChainId);
      getWalletSpy.mockResolvedValue({
        account: keyringAccount as unknown as KeyringAccount,
        index: sender.index,
        scope: keyringAccount.options.scope,
        hdPath: sender.hdPath,
      });

      await expect(
        keyring.submitRequest({
          id: keyringAccount.id,
          scope: Caip2ChainId.Mainnet,
          account: keyringAccount.address,
          request: {
            method: 'btc_sendmany',
          },
        }),
      ).rejects.toThrow(
        "Account's scope does not match with the request's scope",
      );
    });

    it('throws MethodNotFoundError if the method not support', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const { sender, keyringAccount } = await createSender(caip2ChainId);
      getWalletSpy.mockResolvedValue({
        account: keyringAccount as unknown as KeyringAccount,
        index: sender.index,
        scope: keyringAccount.options.scope,
        hdPath: sender.hdPath,
      });

      await expect(
        keyring.submitRequest({
          id: keyringAccount.id,
          scope: caip2ChainId,
          account: keyringAccount.address,
          request: {
            method: 'btc_doesNotExist',
          },
        }),
      ).rejects.toThrow(MethodNotFoundError);
    });
  });

  describe('getAccountBalances', () => {
    it('executes `GetBalancesHandler` with correct parameter', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring, getBalanceRpcSpy } =
        createMockKeyring(stateMgr);
      const { sender, keyringAccount } = await createSender(caip2ChainId);
      getWalletSpy.mockResolvedValue({
        account: keyringAccount as unknown as KeyringAccount,
        index: sender.index,
        scope: keyringAccount.options.scope,
        hdPath: sender.hdPath,
      });

      const assets = [Caip2Asset.TBtc];
      const expectedResp = assets.reduce((acc, asset) => {
        acc[asset] = {
          amount: '1',
          unit: Config.unit,
        };
        return acc;
      }, {});

      getBalanceRpcSpy.mockResolvedValue(expectedResp);

      await keyring.getAccountBalances(keyringAccount.id, [Caip2Asset.TBtc]);

      expect(getBalanceRpcSpy).toHaveBeenCalledWith(expect.any(BtcAccount), {
        scope: caip2ChainId,
        assets,
      });
    });

    it('throws Error if an error catched', async () => {
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      getWalletSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(
        keyring.getAccountBalances(account.id, [Caip2Asset.TBtc]),
      ).rejects.toThrow(Error);
    });
  });
});
