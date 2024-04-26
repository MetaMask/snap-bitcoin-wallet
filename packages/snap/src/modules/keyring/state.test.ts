import { generateAccounts } from '../../../test/utils';
import { Network } from '../bitcoin/constants';
import { SnapHelper, StateError } from '../snap';
import { KeyringStateManager } from './state';

describe('BtcKeyring', () => {
  const createMockStateManager = () => {
    const getDataSpy = jest.spyOn(SnapHelper, 'getStateData');
    const setDataSpy = jest.spyOn(SnapHelper, 'setStateData');
    return {
      instance: new KeyringStateManager(),
      getDataSpy,
      setDataSpy,
    };
  };

  const createInitState = (cnt = 1, scope = Network.Testnet) => {
    const generatedAccounts = generateAccounts(cnt);
    return {
      walletIds: generatedAccounts.map((accounts) => accounts.id),
      wallets: generatedAccounts.reduce((acc, account) => {
        acc[account.id] = {
          account,
          type: account.type,
          index: account.options.index,
          scope,
        };
        return acc;
      }, {}),
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

    it('throw StateError if an error catched', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));

      await expect(instance.listAccounts()).rejects.toThrow(StateError);
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
        type: accountToSave.type,
        index: accountToSave.index,
        scope: accountToSave.scope,
      });

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.wallets[accountToSave.id]).toStrictEqual({
        account: accountToSave,
        type: accountToSave.type,
        index: accountToSave.index,
        scope: accountToSave.scope,
      });
    });

    it('adds an new wallet when state is not empty', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const state = createInitState(5);
      const accountToSave = generateAccounts(1, 'new', 'new')[0];
      getDataSpy.mockResolvedValue(state);

      await instance.addWallet({
        account: accountToSave,
        type: accountToSave.type,
        index: accountToSave.index,
        scope: accountToSave.scope,
      });

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.wallets[accountToSave.id]).toStrictEqual({
        account: accountToSave,
        type: accountToSave.type,
        index: accountToSave.index,
        scope: accountToSave.scope,
      });
    });

    it('throw StateError if the given account id exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const accountToSave = state.wallets[state.walletIds[0]].account;

      await expect(
        instance.addWallet({
          account: accountToSave,
          type: accountToSave.type,
          index: accountToSave.index,
          scope: accountToSave.scope,
        }),
      ).rejects.toThrow(StateError);
    });

    it('throw StateError if the given account address exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const accountToSave = generateAccounts(1, 'new')[0];
      const { address } = state.wallets[state.walletIds[0]].account;
      accountToSave.address = address;

      await expect(
        instance.addWallet({
          account: accountToSave,
          type: accountToSave.type,
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

    it('throw StateError if the account does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      const nonExistAcc = generateAccounts(1, 'notexist', 'notexist')[0];
      getDataSpy.mockResolvedValue(state);

      await expect(
        instance.removeAccounts([nonExistAcc.id, state.walletIds[0]]),
      ).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Account id ${nonExistAcc.id} does not exist`,
      );
    });

    it('throw StateError if an error catched', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const state = createInitState(1);

      await expect(instance.removeAccounts(state.walletIds)).rejects.toThrow(
        StateError,
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
      const { id } = generateAccounts(1, 'notexist', 'notexist')[0];

      const result = await instance.getAccount(id);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('throw StateError if an error catched', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const { id } = generateAccounts(1)[0];

      await expect(instance.getAccount(id)).rejects.toThrow(StateError);
    });
  });

  describe('updateAccount', () => {
    it('update account if the account exist', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);

      const accToUpdate = {
        ...state.wallets[state.walletIds[0]].account,
        methods: ['btc_sendTransactions'],
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

    it('throw StateError if the account does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      const accToUpdate = generateAccounts(1, 'notexist', 'notexist')[0];
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
});
