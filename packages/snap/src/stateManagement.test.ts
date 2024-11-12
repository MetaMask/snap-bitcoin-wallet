import { generateAccounts } from '../test/utils';
import { Caip2ChainId } from './constants';
import type { SendFlowRequest } from './stateManagement';
import { KeyringStateManager, TransactionStatus } from './stateManagement';
import { AssetType } from './ui/types';
import { generateSendBitcoinParams } from './ui/utils';
import * as snapUtil from './utils/snap';

describe('KeyringStateManager', () => {
  const createMockStateManager = () => {
    const getDataSpy = jest.spyOn(snapUtil, 'getStateData');
    const setDataSpy = jest.spyOn(snapUtil, 'setStateData');
    return {
      instance: new KeyringStateManager(),
      getDataSpy,
      setDataSpy,
    };
  };

  const getHdPath = (index: number) => {
    return [`m`, `0'`, `0`, `${index}`].join('/');
  };

  const createInitState = (cnt = 1, scope = Caip2ChainId.Testnet) => {
    const generatedAccounts = generateAccounts(cnt);
    return {
      walletIds: generatedAccounts.map((accounts) => accounts.id),
      wallets: generatedAccounts.reduce((acc, account) => {
        acc[account.id] = {
          account,
          hdPath: getHdPath(account.options.index),
          index: account.options.index,
          scope,
        };
        return acc;
      }, {}),
      requests: {} as Record<string, SendFlowRequest>,
    };
  };

  describe('listAccounts', () => {
    it('returns result', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);

      const result = await instance.listAccounts();

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(
        state.walletIds.map((id) => state.wallets[id].account),
      );
    });

    it('inits keyring state if the state is null', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockResolvedValue(null);

      const result = await instance.listAccounts();

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual([]);
    });

    it('init keyring state `walletIds` if `walletIds` does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockResolvedValue({
        wallets: [],
      });

      const result = await instance.listAccounts();

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual([]);
    });

    it('init keyring state `wallets` if `wallets` does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockResolvedValue({
        account: {},
      });

      const result = await instance.listAccounts();

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual([]);
    });

    it('throws an Error if another Error was thrown', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));

      await expect(instance.listAccounts()).rejects.toThrow(Error);
    });
  });

  describe('addWallet', () => {
    it('adds an new wallet when state is empty', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const accountToSave = generateAccounts(1)[0];
      const state = {
        accounts: [],
        wallets: {},
      };
      getDataSpy.mockResolvedValue(state);

      await instance.addWallet({
        account: accountToSave,
        hdPath: getHdPath(accountToSave.index),
        index: accountToSave.index,
        scope: accountToSave.scope,
      });

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.wallets[accountToSave.id]).toStrictEqual({
        account: accountToSave,
        hdPath: getHdPath(accountToSave.index),
        index: accountToSave.index,
        scope: accountToSave.scope,
      });
    });

    it('adds an new wallet when state is not empty', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const state = createInitState(5);
      const accountToSave = generateAccounts(1, 'new')[0];
      getDataSpy.mockResolvedValue(state);

      await instance.addWallet({
        account: accountToSave,
        hdPath: getHdPath(accountToSave.index),
        index: accountToSave.index,
        scope: accountToSave.scope,
      });

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.wallets[accountToSave.id]).toStrictEqual({
        account: accountToSave,
        hdPath: getHdPath(accountToSave.index),
        index: accountToSave.index,
        scope: accountToSave.scope,
      });
    });

    it('throw Error if the given account id exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const accountToSave = state.wallets[state.walletIds[0]].account;

      await expect(
        instance.addWallet({
          account: accountToSave,
          hdPath: getHdPath(accountToSave.index),
          index: accountToSave.index,
          scope: accountToSave.scope,
        }),
      ).rejects.toThrow(Error);
    });

    it('throw Error if the given account address exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const accountToSave = generateAccounts(1, 'new')[0];
      const { address } = state.wallets[state.walletIds[0]].account;
      accountToSave.address = address;

      await expect(
        instance.addWallet({
          account: accountToSave,
          hdPath: getHdPath(accountToSave.index),
          index: accountToSave.index,
          scope: accountToSave.scope,
        }),
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      ).rejects.toThrow(`Account address ${address} already exists`);
    });
  });

  describe('removeAccounts', () => {
    it('removes account if the account exist', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);

      const lengthB4Remove = state.walletIds.length;
      const testInput = [state.walletIds[0], state.walletIds[10]];

      await instance.removeAccounts(testInput);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.walletIds).toHaveLength(lengthB4Remove - testInput.length);
      expect(state.wallets).not.toContain(testInput[0]);
      expect(state.wallets).not.toContain(testInput[1]);
    });

    it('throw Error if the account does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      const nonExistAcc = generateAccounts(1, 'notexist')[0];
      getDataSpy.mockResolvedValue(state);

      await expect(
        instance.removeAccounts([nonExistAcc.id, state.walletIds[0]]),
      ).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Account id ${nonExistAcc.id} does not exist`,
      );
    });

    it('throws an Error if another Error was thrown', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const state = createInitState(1);

      await expect(instance.removeAccounts(state.walletIds)).rejects.toThrow(
        Error,
      );
    });
  });

  describe('getAccount', () => {
    it('returns result', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const id = state.walletIds[0];

      const result = await instance.getAccount(id);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(state.wallets[id].account);
    });

    it('returns null if the account does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const { id } = generateAccounts(1, 'notexist')[0];

      const result = await instance.getAccount(id);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('throws an Error if another Error was thrown', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const { id } = generateAccounts(1)[0];

      await expect(instance.getAccount(id)).rejects.toThrow(Error);
    });
  });

  describe('updateAccount', () => {
    it('update account if the account exist', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);

      const accToUpdate = {
        ...state.wallets[state.walletIds[0]].account,
        methods: ['newBtcMethod'],
      };

      await instance.updateAccount(accToUpdate);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          wallets: expect.objectContaining({
            [accToUpdate.id]: expect.objectContaining({
              account: accToUpdate,
            }),
          }),
        }),
      );
    });

    it('throw Error if the account does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      const accToUpdate = generateAccounts(1, 'notexist')[0];
      getDataSpy.mockResolvedValue(state);

      await expect(instance.updateAccount(accToUpdate)).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Account id ${accToUpdate.id} does not exist`,
      );
    });

    it('throw `immutable` error if the update value is address', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      const accToUpdate = {
        ...state.wallets[state.walletIds[0]].account,
        address: state.wallets[state.walletIds[1]].account.address,
      };
      getDataSpy.mockResolvedValue(state);

      await expect(instance.updateAccount(accToUpdate)).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Account address or type is immutable`,
      );
    });

    it('throw `immutable` error if the update value is type', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      const accToUpdate = {
        ...state.wallets[state.walletIds[0]].account,
        type: 'someothertype',
      };
      getDataSpy.mockResolvedValue(state);

      await expect(instance.updateAccount(accToUpdate)).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Account address or type is immutable`,
      );
    });
  });

  describe('getWallet', () => {
    it('returns result', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const { id } = state.wallets[state.walletIds[0]].account;

      const result = await instance.getWallet(id);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(state.wallets[state.walletIds[0]]);
    });

    it('returns null if the id does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const { id } = generateAccounts(1, 'notexist')[0];

      const result = await instance.getWallet(id);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('throws when getData fails', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const state = createInitState(20);
      const { id } = state.wallets[state.walletIds[0]].account;

      await expect(instance.getWallet(id)).rejects.toThrow(Error);
    });
  });

  describe('Requests', () => {
    describe('getRequest', () => {
      it('returns the request if it exists', async () => {
        const { instance, getDataSpy } = createMockStateManager();
        const state = createInitState(20);
        const requestId = 'request-1';
        const request = {
          id: requestId,
          interfaceId: 'interface-1',
          account: state.wallets[state.walletIds[0]].account,
          scope: 'scope-1',
          transaction: {
            ...generateSendBitcoinParams('scope-1'),
            sender: 'sender-1',
            recipient: 'recipient-1',
            amount: '1',
            total: '1',
          },
          status: TransactionStatus.Draft,
          selectedCurrency: AssetType.BTC,
          recipient: {
            address: 'recipient-address',
            error: '',
            valid: true,
          },
          fees: {
            amount: '0.0001',
            fiat: '0.01',
            loading: false,
            error: '',
          },
          amount: {
            amount: '1',
            fiat: '100',
            error: '',
            valid: true,
          },
          rates: '100',
          balance: {
            amount: '10',
            fiat: '1000',
          },
          total: {
            amount: '1.0001',
            fiat: '100.01',
            error: '',
            valid: true,
          },
        };
        state.requests[requestId] = request;
        getDataSpy.mockResolvedValue(state);

        const result = await instance.getRequest(requestId);

        expect(getDataSpy).toHaveBeenCalledTimes(1);
        expect(result).toStrictEqual(request);
      });

      it('returns null if the request does not exist', async () => {
        const { instance, getDataSpy } = createMockStateManager();
        const state = createInitState(20);
        getDataSpy.mockResolvedValue(state);
        const requestId = 'non-existent-request';

        const result = await instance.getRequest(requestId);

        expect(getDataSpy).toHaveBeenCalledTimes(1);
        expect(result).toBeNull();
      });

      it('returns null if the state is null', async () => {
        const { instance, getDataSpy } = createMockStateManager();
        getDataSpy.mockResolvedValue(null);
        const requestId = 'request-1';

        const result = await instance.getRequest(requestId);

        expect(getDataSpy).toHaveBeenCalledTimes(1);
        expect(result).toBeNull();
      });

      it('throws an Error if another Error was thrown', async () => {
        const { instance, getDataSpy } = createMockStateManager();
        getDataSpy.mockRejectedValue(new Error('error'));
        const requestId = 'request-1';

        await expect(instance.getRequest(requestId)).rejects.toThrow(Error);
      });
    });

    describe('upsertRequest', () => {
      it('adds a new request if it does not exist', async () => {
        const { instance, getDataSpy, setDataSpy } = createMockStateManager();
        const state = createInitState(20);
        getDataSpy.mockResolvedValue(state);
        const requestId = 'new-request';
        const newRequest: SendFlowRequest = {
          id: requestId,
          interfaceId: 'interface-1',
          account: state.wallets[state.walletIds[0]].account,
          scope: 'scope-1',
          transaction: {
            ...generateSendBitcoinParams('scope-1'),
          },
          status: TransactionStatus.Draft,
          selectedCurrency: AssetType.BTC,
          recipient: {
            address: 'recipient-address',
            error: '',
            valid: true,
          },
          fees: {
            amount: '0.0001',
            fiat: '0.01',
            loading: false,
            error: '',
          },
          amount: {
            amount: '1',
            fiat: '100',
            error: '',
            valid: true,
          },
          rates: '100',
          balance: {
            amount: '10',
            fiat: '1000',
          },
          total: {
            amount: '1.0001',
            fiat: '100.01',
            error: '',
            valid: true,
          },
        };

        await instance.upsertRequest(newRequest);

        expect(getDataSpy).toHaveBeenCalledTimes(1);
        expect(setDataSpy).toHaveBeenCalledTimes(1);
        expect(state.requests[requestId]).toStrictEqual(newRequest);
      });

      it('updates an existing request if it exists', async () => {
        const { instance, getDataSpy, setDataSpy } = createMockStateManager();
        const state = createInitState(20);
        const requestId = 'existing-request';
        const existingRequest: SendFlowRequest = {
          id: requestId,
          interfaceId: 'interface-1',
          account: state.wallets[state.walletIds[0]].account,
          scope: 'scope-1',
          transaction: {
            ...generateSendBitcoinParams('scope-1'),
          },
          status: TransactionStatus.Draft,
          selectedCurrency: AssetType.BTC,
          recipient: {
            address: 'recipient-address',
            error: '',
            valid: true,
          },
          fees: {
            amount: '0.0001',
            fiat: '0.01',
            loading: false,
            error: '',
          },
          amount: {
            amount: '1',
            fiat: '100',
            error: '',
            valid: true,
          },
          rates: '100',
          balance: {
            amount: '10',
            fiat: '1000',
          },
          total: {
            amount: '1.0001',
            fiat: '100.01',
            error: '',
            valid: true,
          },
        };
        state.requests[requestId] = existingRequest;
        getDataSpy.mockResolvedValue(state);

        const updatedRequest: SendFlowRequest = {
          ...existingRequest,
          status: TransactionStatus.Review,
        };

        await instance.upsertRequest(updatedRequest);

        expect(getDataSpy).toHaveBeenCalledTimes(1);
        expect(setDataSpy).toHaveBeenCalledTimes(1);
        expect(state.requests[requestId]).toStrictEqual(updatedRequest);
      });

      it('throws an Error if another Error was thrown', async () => {
        const { instance, getDataSpy } = createMockStateManager();
        getDataSpy.mockRejectedValue(new Error('error'));
        const requestId = 'request-1';
        const request: SendFlowRequest = {
          id: requestId,
          interfaceId: 'interface-1',
          account: generateAccounts(1)[0],
          scope: 'scope-1',
          transaction: {
            ...generateSendBitcoinParams('scope-1'),
          },
          status: TransactionStatus.Draft,
          selectedCurrency: AssetType.BTC,
          recipient: {
            address: 'recipient-address',
            error: '',
            valid: true,
          },
          fees: {
            amount: '0.0001',
            fiat: '0.01',
            loading: false,
            error: '',
          },
          amount: {
            amount: '1',
            fiat: '100',
            error: '',
            valid: true,
          },
          rates: '100',
          balance: {
            amount: '10',
            fiat: '1000',
          },
          total: {
            amount: '1.0001',
            fiat: '100.01',
            error: '',
            valid: true,
          },
        };

        await expect(instance.upsertRequest(request)).rejects.toThrow(Error);
      });
    });
    describe('removeRequest', () => {
      it('removes the request if it exists', async () => {
        const { instance, getDataSpy, setDataSpy } = createMockStateManager();
        const state = createInitState(20);
        const requestId = 'request-to-remove';
        const request: SendFlowRequest = {
          id: requestId,
          interfaceId: 'interface-1',
          account: state.wallets[state.walletIds[0]].account,
          scope: 'scope-1',
          transaction: {
            ...generateSendBitcoinParams('scope-1'),
          },
          status: TransactionStatus.Draft,
          selectedCurrency: AssetType.BTC,
          recipient: {
            address: 'recipient-address',
            error: '',
            valid: true,
          },
          fees: {
            amount: '0.0001',
            fiat: '0.01',
            loading: false,
            error: '',
          },
          amount: {
            amount: '1',
            fiat: '100',
            error: '',
            valid: true,
          },
          rates: '100',
          balance: {
            amount: '10',
            fiat: '1000',
          },
          total: {
            amount: '1.0001',
            fiat: '100.01',
            error: '',
            valid: true,
          },
        };
        state.requests[requestId] = request;
        getDataSpy.mockResolvedValue(state);

        await instance.removeRequest(requestId);

        expect(getDataSpy).toHaveBeenCalledTimes(1);
        expect(setDataSpy).toHaveBeenCalledTimes(1);
        expect(state.requests[requestId]).toBeUndefined();
      });

      it('does nothing if the request does not exist', async () => {
        const { instance, getDataSpy, setDataSpy } = createMockStateManager();
        const state = createInitState(20);
        getDataSpy.mockResolvedValue(state);
        const requestId = 'non-existent-request';

        await instance.removeRequest(requestId);

        expect(getDataSpy).toHaveBeenCalledTimes(1);
        expect(setDataSpy).toHaveBeenCalledTimes(1);
        expect(state.requests[requestId]).toBeUndefined();
      });

      it('throws an Error if another Error was thrown', async () => {
        const { instance, getDataSpy } = createMockStateManager();
        getDataSpy.mockRejectedValue(new Error('error'));
        const requestId = 'request-1';

        await expect(instance.removeRequest(requestId)).rejects.toThrow(Error);
      });
    });
  });
});
