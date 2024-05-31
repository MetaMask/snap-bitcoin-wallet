import { MethodNotFoundError } from '@metamask/snaps-sdk';
import { unknown } from 'superstruct';

import { generateAccounts } from '../../test/utils';
import { Chain, Config } from '../config';
import { Factory } from '../factory';
import { BtcAsset, Network } from '../modules/bitcoin/constants';
import { type IStaticSnapRpcHandler, BaseSnapRpcHandler } from '../modules/rpc';
import { GetBalancesHandler } from '../rpcs';
import { RpcHelper } from '../rpcs/helpers';
import type { StaticImplements } from '../types/static';
import type { IWallet } from '../wallet';
import { BtcKeyringError } from './exceptions';
import { BtcKeyring } from './keyring';
import { KeyringStateManager } from './state';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

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

    jest.spyOn(RpcHelper, 'getKeyringRpcApiHandlers').mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendmany: RpcHandler,
    });

    return {
      instance: new BtcKeyring(stateMgr, {
        defaultIndex: 0,
        multiAccount: false,
      }),
      handleRequestSpy,
    };
  };

  const getHdPath = (index: number) => {
    return [`m`, `0'`, `0`, `${index}`].join('/');
  };

  describe('createAccount', () => {
    it('creates account', async () => {
      const { unlockSpy } = createMockWallet();
      const { instance: stateMgr, addWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const scope = Network.Testnet;
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
        Config.wallet[Chain.Bitcoin].defaultAccountIndex,
        Config.wallet[Chain.Bitcoin].defaultAccountType,
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

    it('throws BtcKeyringError if an error catched', async () => {
      const { unlockSpy } = createMockWallet();
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
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring, handleRequestSpy } =
        createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];
      const params = {
        scope: 'bip122:000000000933ea01ad0ee984209779ba',
        amounts: {
          bc1qrp0yzgkf8rawkuvdlhnjfj2fnjwm0m8727kgah: '0.01',
          bc1qf5n2h6mgelkls4497pkpemew55xpew90td2qae: '0.01',
        },
        comment: 'testing',
        subtractFeeFrom: ['bc1qrp0yzgkf8rawkuvdlhnjfj2fnjwm0m8727kgah'],
        replaceable: false,
      };
      getWalletSpy.mockResolvedValue({
        account,
        index: account.options.index,
        scope: account.options.scope,
        hdPath: getHdPath(account.options.index),
      });

      await keyring.submitRequest({
        id: account.id,
        scope: Network.Testnet,
        account: account.address,
        request: {
          method: 'btc_sendmany',
          params,
        },
      });

      expect(handleRequestSpy).toHaveBeenCalledWith(params);
    });

    it('throws `Account not found` error if the account address not found', async () => {
      const { instance: stateMgr } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];

      await expect(
        keyring.submitRequest({
          id: account.id,
          scope: Network.Testnet,
          account: account.address,
          request: {
            method: 'btc_sendmany',
          },
        }),
      ).rejects.toThrow('Account not found');
    });

    it("throws `Account's scope does not match with the request's scope` error if given scope is not match with the account", async () => {
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];

      getWalletSpy.mockResolvedValue({
        account,
        index: account.options.index,
        scope: account.options.scope,
        hdPath: getHdPath(account.options.index),
      });

      await expect(
        keyring.submitRequest({
          id: account.id,
          scope: Network.Mainnet,
          account: account.address,
          request: {
            method: 'btc_sendmany',
          },
        }),
      ).rejects.toThrow(
        "Account's scope does not match with the request's scope",
      );
    });

    it('throws MethodNotFoundError if the method not support', async () => {
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
      ).rejects.toThrow(MethodNotFoundError);
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

  describe('getAccountBalances', () => {
    it('executes `GetBalancesHandler` with correct parameter', async () => {
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      const account = generateAccounts(1)[0];
      const assets = [BtcAsset.TBtc];
      const getBalancesHandlerSpy = jest.spyOn(
        GetBalancesHandler.prototype,
        'execute',
      );
      getBalancesHandlerSpy.mockResolvedValue(
        assets.reduce((acc, asset) => {
          acc[asset] = {
            amount: '1',
            unit: Config.unit[Chain.Bitcoin],
          };
          return acc;
        }),
      );
      getWalletSpy.mockResolvedValue({
        account,
        index: account.options.index,
        scope: account.options.scope,
        hdPath: getHdPath(account.options.index),
      });

      await keyring.getAccountBalances(account.id, [BtcAsset.TBtc]);

      expect(getBalancesHandlerSpy).toHaveBeenCalledWith({
        scope: account.options.scope,
        assets,
      });
    });

    it('throws BtcKeyringError if an error catched', async () => {
      const { instance: stateMgr, getWalletSpy } = createMockStateMgr();
      const { instance: keyring } = createMockKeyring(stateMgr);
      getWalletSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(
        keyring.getAccountBalances(account.id, [BtcAsset.TBtc]),
      ).rejects.toThrow(BtcKeyringError);
    });
  });
});
