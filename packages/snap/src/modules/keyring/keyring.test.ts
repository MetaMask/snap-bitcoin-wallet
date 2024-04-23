import { unknown } from 'superstruct';

import { generateAccounts } from '../../../test/utils';
import type { IStaticSnapRpcHandler } from '../../rpcs';
import { BaseSnapRpcHandler } from '../../rpcs';
import type { StaticImplements } from '../../types/static';
import { Network } from '../bitcoin/config';
import { Chain, Config } from '../config';
import { Factory } from '../factory';
import { BtcKeyringError } from './exceptions';
import { BtcKeyring } from './keyring';
import { KeyringStateManager } from './state';
import type { IAccountMgr } from './types';

jest.mock('../logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

jest.mock('@metamask/keyring-api', () => ({
  ...jest.requireActual('@metamask/keyring-api'),
  emitSnapKeyringEvent: jest.fn(),
}));

describe('BtcKeyring', () => {
  const createMockAccountMgr = () => {
    const unlockSpy = jest.fn();
    class AccountMgr implements IAccountMgr {
      unlock = unlockSpy;
    }
    jest
      .spyOn(Factory, 'createAccountMgr')
      .mockImplementation()
      .mockReturnValue(new AccountMgr());
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

    return {
      instance: new KeyringStateManager(),
      listAccountsSpy,
      addWalletSpy,
      removeAccountsSpy,
      getAccountSpy,
      updateAccountSpy,
    };
  };

  const createMockChainRPCHandler = () => {
    const handleRequestSpy = jest.fn();
    class MockChainRpcHandler
      extends BaseSnapRpcHandler
      implements
        StaticImplements<IStaticSnapRpcHandler, typeof MockChainRpcHandler>
    {
      static override get requestStruct() {
        return unknown();
      }

      handleRequest = handleRequestSpy;
    }
    return {
      instance: MockChainRpcHandler,
      handleRequestSpy,
    };
  };

  const createMockKeyring = (stateMgr: KeyringStateManager) => {
    const { instance: RpcHandler, handleRequestSpy } =
      createMockChainRPCHandler();
    const chainRPCHanlers = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendTransaction: RpcHandler,
    };

    return {
      instance: new BtcKeyring(stateMgr, chainRPCHanlers, {
        defaultIndex: 0,
        multiAccount: false,
      }),
      handleRequestSpy,
    };
  };

  describe('createAccount', () => {
    it('creates account', async () => {
      const { unlockSpy } = createMockAccountMgr();
      const { instance: stateMgr, addWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const scope = Network.Testnet;
      const account = generateAccounts(1)[0];

      unlockSpy.mockResolvedValue({
        address: account.address,
        hdPath: account.options.hdPath,
        index: account.options.index,
        type: account.type,
      });

      await keyring.createAccount({
        scope,
      });

      expect(unlockSpy).toHaveBeenCalledWith(
        Config.account[Chain.Bitcoin].defaultAccountIndex,
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
        type: account.type,
        index: account.options.index,
        scope,
      });
    });

    it('throws BtcKeyringError if an error catched', async () => {
      const { unlockSpy } = createMockAccountMgr();
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      unlockSpy.mockRejectedValue(new Error('error'));
      const scope = Network.Testnet;

      await expect(
        keyring.createAccount({
          scope,
        }),
      ).rejects.toThrow(BtcKeyringError);
    });

    it('throws `Invalid params to create account` if the create options is invalid', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);

      await expect(
        keyring.createAccount({
          scope: 'invalid',
        }),
      ).rejects.toThrow(`Invalid params to create account`);
    });
  });

  describe('filterAccountChains', () => {
    it('throws `Method not implemented` error', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];

      await expect(
        keyring.filterAccountChains(account.id, [Network.Testnet]),
      ).rejects.toThrow('Method not implemented.');
    });
  });

  describe('submitRequest', () => {
    it('calls SnapRpcHandler if the method support', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring, handleRequestSpy } =
        createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];
      const params = {
        scope: 'bip122:000000000019d6689c085ae165831e93',
        accounts: [
          'bc1qrp0yzgkf8rawkuvdlhnjfj2fnjwm0m8727kgah',
          'bc1qf5n2h6mgelkls4497pkpemew55xpew90td2qae',
        ],
        assets: ['bip122:000000000019d6689c085ae165831e93/asset:0'],
      };
      await keyring.submitRequest({
        id: account.id,
        scope: Network.Testnet,
        account: account.address,
        request: {
          method: 'btc_sendTransaction',
          params,
        },
      });

      expect(handleRequestSpy).toHaveBeenCalledWith(params);
    });

    it('throws `Method not found` if the method not support', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];

      await expect(
        keyring.submitRequest({
          id: account.id,
          scope: Network.Testnet,
          account: account.address,
          request: {
            method: 'btc_doesNotExist',
          },
        }),
      ).rejects.toThrow('Method not found: btc_doesNotExist');
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

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: stateMgr, listAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      listAccountsSpy.mockRejectedValue(new Error('error'));

      await expect(keyring.listAccounts()).rejects.toThrow(BtcKeyringError);
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

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: stateMgr, getAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      getAccountSpy.mockRejectedValue(new Error('error'));
      const accounts = generateAccounts(1);

      await expect(keyring.getAccount(accounts[0].id)).rejects.toThrow(
        BtcKeyringError,
      );
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

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: stateMgr, updateAccountSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      updateAccountSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(keyring.updateAccount(account)).rejects.toThrow(
        BtcKeyringError,
      );
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

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: stateMgr, removeAccountsSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      removeAccountsSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(keyring.deleteAccount(account.id)).rejects.toThrow(
        BtcKeyringError,
      );
    });
  });
});
