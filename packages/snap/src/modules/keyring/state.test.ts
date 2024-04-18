import { generateAccounts } from '../../../test/utils';
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

  const createInitState = (cnt = 1) => {
    const generatedAccounts = generateAccounts(cnt);
    return {
      accounts: generatedAccounts.map((accounts) => accounts.id),
      accountDetails: generatedAccounts.reduce((acc, account) => {
        acc[account.id] = account;
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
        state.accounts.map((id) => state.accountDetails[id]),
      );
    });

    it('inits keyring state if the state is null', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockResolvedValue(null);

      const result = await instance.listAccounts();

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual([]);
    });

    it('init keyring state `accounts` if `accounts` does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockResolvedValue({
        accounts: [],
      });

      const result = await instance.listAccounts();

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual([]);
    });

    it('init keyring state `accountDetails` if `accountDetails` does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockResolvedValue({
        accountDetails: {},
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

  describe('saveAccount', () => {
    it('updates account if the account exist', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const accountToSave = { ...state.accountDetails[state.accounts[0]] };
      accountToSave.options.hdPath = 'm/1/0/0';

      await instance.saveAccount(accountToSave);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.accountDetails[state.accounts[0]]).toStrictEqual(
        accountToSave,
      );
    });

    it('adds account if the account not exist', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const accountToSave = generateAccounts(1)[0];
      const state = {
        accounts: [],
        accountDetails: {},
      };
      getDataSpy.mockResolvedValue(state);

      await instance.saveAccount(accountToSave);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.accounts).toHaveLength(1);
      expect(state.accountDetails).toStrictEqual({
        [accountToSave.id]: accountToSave,
      });
    });

    it('throw StateError if an error catched', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const state = createInitState(1);

      await expect(
        instance.saveAccount(state.accountDetails[state.accounts[0]]),
      ).rejects.toThrow(StateError);
    });
  });

  describe('removeAccounts', () => {
    it('removes account if the account exist', async () => {
      const { instance, getDataSpy, setDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);

      const lengthB4Remove = state.accounts.length;
      const testInput = [state.accounts[0], state.accounts[10]];

      await instance.removeAccounts(testInput);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(setDataSpy).toHaveBeenCalledTimes(1);
      expect(state.accounts).toHaveLength(lengthB4Remove - testInput.length);
      expect(state.accountDetails).not.toContain(testInput[0]);
      expect(state.accountDetails).not.toContain(testInput[1]);
    });

    it('throw StateError if the account does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      const nonExistAcc = generateAccounts(1, 'notexist', 'notexist')[0];
      getDataSpy.mockResolvedValue(state);

      await expect(
        instance.removeAccounts([nonExistAcc.id, state.accounts[0]]),
      ).rejects.toThrow(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Account with id ${nonExistAcc.id} does not exist`,
      );
    });

    it('throw StateError if an error catched', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const state = createInitState(1);

      await expect(instance.removeAccounts(state.accounts)).rejects.toThrow(
        StateError,
      );
    });
  });

  describe('getAccount', () => {
    it('returns result', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const id = state.accounts[0];

      const result = await instance.getAccount(id);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(state.accountDetails[id]);
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

  describe('getAccountByAddress', () => {
    it('returns result', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const id = state.accounts[0];
      const { address } = state.accountDetails[id];

      const result = await instance.getAccountByAddress(address);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(state.accountDetails[id]);
    });

    it('returns null if the account does not exist', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      const state = createInitState(20);
      getDataSpy.mockResolvedValue(state);
      const nonExistAcc = generateAccounts(1, 'notexist', 'notexist')[0];

      const result = await instance.getAccountByAddress(nonExistAcc.address);

      expect(getDataSpy).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('throw StateError if an error catched', async () => {
      const { instance, getDataSpy } = createMockStateManager();
      getDataSpy.mockRejectedValue(new Error('error'));
      const acc = generateAccounts(1)[0];

      await expect(instance.getAccountByAddress(acc.id)).rejects.toThrow(
        StateError,
      );
    });
  });
});
