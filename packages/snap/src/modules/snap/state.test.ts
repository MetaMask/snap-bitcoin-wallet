import { expect } from '@jest/globals';

import { StateError } from './exceptions';
import { SnapHelper } from './helpers';
import { MutexLock } from './lock';
import { SnapStateManager } from './state';

jest.mock('../logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

type MockTransactionDetail = {
  txnHash: string;
  cnt: number;
};

type MockTransactionDetails = {
  [key in string]: MockTransactionDetail;
};

type MockTransactions = string[];

type MockState = {
  transaction: MockTransactions;
  trasansactionDetails: MockTransactionDetails;
};

type MockExecuteTransactionInput = {
  txnHash: string;
  id: string;
  cnt: number;
};

describe('SnapStateManager', () => {
  const createMockStateManager = <State, StateDataInput>(
    createLock?: boolean,
  ) => {
    const updateDataSpy = jest.fn();
    class MockSnapStateManager extends SnapStateManager<State> {
      constructor() {
        super(createLock);
      }

      async getData() {
        return this.get();
      }

      async updateData(data: StateDataInput) {
        await this.update(async (state) => updateDataSpy(state, data));
      }
    }

    const instance = new MockSnapStateManager();

    const executeTransationFn = async (
      data: StateDataInput,
      delay: number,
      isThrowError?: boolean,
      isCommit?: boolean,
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await instance.withTransaction(async (state) => {
        await instance.updateData(data);
        if (isCommit === true) {
          await instance.commit();
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (isThrowError) {
          throw new Error('executeTransationFn error');
        }
      });
    };

    const executeFn = async (data, delay, isThrowError = false) => {
      await instance.updateData(data);
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (isThrowError) {
        throw new Error('executeFn error');
      }
    };

    return {
      instance,
      updateDataSpy,
      executeTransationFn,
      executeFn,
    };
  };

  const createMockState = (initState: MockState) => {
    const setStateDataFn = async (data: MockState) => {
      initState.transaction = [...data.transaction];
      initState.trasansactionDetails = Object.entries(
        data.trasansactionDetails,
      ).reduce(
        (acc, [key, value]: [key: string, value: MockTransactionDetail]) => {
          acc[key] = {
            ...value,
          };
          return acc;
        },
        {},
      );
    };

    const updateDataFn = (
      state: MockState,
      data: MockExecuteTransactionInput,
    ) => {
      if (
        Object.prototype.hasOwnProperty.call(
          state.trasansactionDetails,
          data.id,
        ) === false
      ) {
        state.transaction.push(data.id);
        state.trasansactionDetails[data.id] = {
          txnHash: data.txnHash,
          cnt: data.cnt,
        };
      } else {
        state.trasansactionDetails[data.id] = {
          txnHash: data.txnHash,
          cnt: state.trasansactionDetails[data.id].cnt + data.cnt,
        };
      }
    };

    const getStateDataSpy = jest
      .spyOn(SnapHelper, 'getStateData')
      .mockImplementation(async () => {
        return {
          transaction: [...initState.transaction],
          trasansactionDetails: Object.entries(
            initState.trasansactionDetails,
          ).reduce(
            (
              acc,
              [key, value]: [key: string, value: MockTransactionDetail],
            ) => {
              acc[key] = {
                ...value,
              };
              return acc;
            },
            {},
          ),
        };
      });

    const setStateDataSpy = jest
      .spyOn(SnapHelper, 'setStateData')
      .mockImplementation(setStateDataFn);

    return {
      setStateDataFn,
      updateDataFn,
      getStateDataSpy,
      setStateDataSpy,
    };
  };

  describe('constructor', () => {
    it('sends `false` to Lock.Acquire if parameter `createLock` is `undefined`', async () => {
      const spy = jest.spyOn(MutexLock, 'acquire');
      createMockStateManager();

      expect(spy).toHaveBeenCalledWith(false);
    });

    it('sends `true` to Lock.Acquire if parameter `createLock` is `true`', async () => {
      const spy = jest.spyOn(MutexLock, 'acquire');
      createMockStateManager(true);

      expect(spy).toHaveBeenCalledWith(true);
    });
  });

  describe('get', () => {
    it('returns result', async () => {
      const { instance } = createMockStateManager(false);
      const state = {
        transaction: [
          {
            txnHash: 'hash',
            chainId: 'chainId',
          },
        ],
      };
      const readSpy = jest
        .spyOn(SnapHelper, 'getStateData')
        .mockResolvedValue(state);
      const result = await instance.getData();

      expect(readSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(state);
    });
  });

  describe('update', () => {
    it('updates state', async () => {
      const { instance, updateDataSpy } = createMockStateManager(false);
      const testcase = {
        state: {
          transaction: [
            {
              txnHash: 'hash',
              chainId: 'chainId',
            },
          ],
        },
        data: {
          txnHash: 'hash2',
          chainId: 'chainId2',
        },
      };
      const readSpy = jest
        .spyOn(SnapHelper, 'getStateData')
        .mockResolvedValue(testcase.state);
      const writeSpy = jest.spyOn(SnapHelper, 'setStateData');
      updateDataSpy.mockImplementation((state, data) => {
        state.transaction.push(data);
      });

      await instance.updateData(testcase.data);

      expect(readSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(testcase.state);
      expect(testcase.state.transaction).toHaveLength(2);
      expect(updateDataSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('withTransaction', () => {
    it('executes callback code', async () => {
      const initState = {
        transaction: ['id'],
        trasansactionDetails: {
          id: {
            txnHash: 'hash',
            cnt: 4,
          },
        },
      };

      const { getStateDataSpy, updateDataFn } = createMockState(initState);

      const { updateDataSpy, executeTransationFn } = createMockStateManager<
        MockState,
        MockExecuteTransactionInput
      >();

      updateDataSpy.mockImplementation(updateDataFn);

      const promiseArr = [
        executeTransationFn(
          {
            txnHash: 'hash-final',
            id: 'id',
            cnt: 2,
          },
          30,
        ),
        executeTransationFn(
          {
            txnHash: 'hash2',
            id: 'id2',
            cnt: 5,
          },
          0,
        ),
      ];

      await Promise.all(promiseArr);
      expect(initState.transaction).toStrictEqual(['id', 'id2']);

      expect(initState.trasansactionDetails).toStrictEqual({
        id: {
          txnHash: 'hash-final',
          cnt: 6,
        },
        id2: {
          txnHash: 'hash2',
          cnt: 5,
        },
      });
      expect(getStateDataSpy).toHaveBeenCalledTimes(promiseArr.length * 2);
      //  expect(setStateDataSpy).toHaveBeenCalledTimes(promiseArr.length);
      expect(updateDataSpy).toHaveBeenCalledTimes(promiseArr.length);
    });

    it('does rollback if an error catched and has committed', async () => {
      const initState = {
        transaction: ['id'],
        trasansactionDetails: {
          id: {
            txnHash: 'hash',
            cnt: 4,
          },
        },
      };
      const { getStateDataSpy, updateDataFn } = createMockState(initState);
      const { updateDataSpy, executeTransationFn } = createMockStateManager<
        MockState,
        MockExecuteTransactionInput
      >();
      updateDataSpy.mockImplementation(updateDataFn);

      const promiseArr = [
        executeTransationFn(
          {
            txnHash: 'hash4',
            id: 'id',
            cnt: 1,
          },
          10,
        ),
        executeTransationFn(
          {
            txnHash: 'hash-final',
            id: 'id',
            cnt: 2,
          },
          30,
          true,
          true,
        ),
        executeTransationFn(
          {
            txnHash: 'hash2',
            id: 'id2',
            cnt: 5,
          },
          0,
        ),
      ];

      await Promise.allSettled(promiseArr);

      expect(initState.transaction).toStrictEqual(['id', 'id2']);
      expect(initState.trasansactionDetails).toStrictEqual({
        id: {
          txnHash: 'hash4',
          cnt: 5,
        },
        id2: {
          txnHash: 'hash2',
          cnt: 5,
        },
      });
      expect(getStateDataSpy).toHaveBeenCalledTimes(promiseArr.length * 2);
      expect(updateDataSpy).toHaveBeenCalledTimes(promiseArr.length);
    });

    it('does not trigger rollback if an error catched and has not committed', async () => {
      const hasCommited = false;
      const initState: MockState = {
        transaction: ['id'],
        trasansactionDetails: {
          id: {
            txnHash: 'hash',
            cnt: 4,
          },
        },
      };
      const { setStateDataSpy, updateDataFn } = createMockState(initState);
      const { updateDataSpy, executeTransationFn } = createMockStateManager<
        MockState,
        MockExecuteTransactionInput
      >();
      updateDataSpy.mockImplementation(updateDataFn);

      let expectedError;
      try {
        await executeTransationFn(
          {
            txnHash: 'hash-final',
            id: 'id',
            cnt: 2,
          },
          30,
          true,
          hasCommited,
        );
      } catch (error) {
        expectedError = error;
      } finally {
        expect(expectedError).toBeInstanceOf(StateError);
        expect(initState.transaction).toStrictEqual(['id']);
        expect(setStateDataSpy).toHaveBeenCalledTimes(0);
        expect(initState.trasansactionDetails).toStrictEqual({
          id: {
            txnHash: 'hash',
            cnt: 4,
          },
        });
      }
    });

    it('does not rollback if rollback failed and has committed', async () => {
      const committed = true;
      const initState: MockState = {
        transaction: ['id'],
        trasansactionDetails: {
          id: {
            txnHash: 'hash',
            cnt: 4,
          },
        },
      };
      const { setStateDataSpy, updateDataFn, setStateDataFn } =
        createMockState(initState);
      const { updateDataSpy, executeTransationFn } = createMockStateManager<
        MockState,
        MockExecuteTransactionInput
      >();
      setStateDataSpy
        .mockImplementationOnce(setStateDataFn)
        .mockImplementationOnce(() => {
          throw new Error('rollback error');
        });
      updateDataSpy.mockImplementation(updateDataFn);

      const promiseArr = [
        executeTransationFn(
          {
            txnHash: 'hash-final',
            id: 'id',
            cnt: 2,
          },
          30,
          true,
          committed,
        ),
        executeTransationFn(
          {
            txnHash: 'hash-final',
            id: 'id',
            cnt: 2,
          },
          30,
          true,
          false,
        ),
      ];
      await Promise.allSettled(promiseArr);

      expect(initState.transaction).toStrictEqual(['id']);
      expect(initState.trasansactionDetails).toStrictEqual({
        id: {
          txnHash: 'hash-final',
          cnt: 6,
        },
      });
    });

    it('does not have racing condition', async () => {
      const initState = {
        transaction: [],
        trasansactionDetails: {},
      };
      const { getStateDataSpy, updateDataFn } = createMockState(initState);
      const { updateDataSpy, executeTransationFn, executeFn } =
        createMockStateManager<MockState, MockExecuteTransactionInput>();

      updateDataSpy.mockImplementation(updateDataFn);

      const promiseArr = [
        executeTransationFn(
          {
            txnHash: 'hash',
            id: 'id',
            cnt: 2,
          },
          30,
        ),
        executeTransationFn(
          {
            txnHash: 'hash2',
            id: 'id2',
            cnt: 5,
          },
          20,
        ),
        executeFn(
          {
            txnHash: 'hash32',
            id: 'id3',
            cnt: 8,
          },
          0,
        ),
        executeTransationFn(
          {
            txnHash: 'hash-updated',
            id: 'id',
            cnt: 1,
          },
          30,
        ),
        executeTransationFn(
          {
            txnHash: 'hash3',
            id: 'id3',
            cnt: 2,
          },
          10,
        ),
        executeTransationFn(
          {
            txnHash: 'hash-updated-final',
            id: 'id',
            cnt: 3,
          },
          2,
        ),
      ];

      await Promise.all(promiseArr);

      expect(initState.transaction).toStrictEqual(['id', 'id2', 'id3']);
      expect(initState.trasansactionDetails).toStrictEqual({
        id: {
          txnHash: 'hash-updated-final',
          cnt: 6,
        },
        id2: {
          txnHash: 'hash2',
          cnt: 5,
        },
        id3: {
          txnHash: 'hash3',
          cnt: 10,
        },
      });
      expect(getStateDataSpy).toHaveBeenCalledTimes(promiseArr.length * 2 - 1);
      expect(updateDataSpy).toHaveBeenCalledTimes(promiseArr.length);
    });

    it('throws `Failed to begin transaction` error, if the transaction can not init', async () => {
      const initState = {
        transaction: [],
        trasansactionDetails: {},
      };

      const { getStateDataSpy } = createMockState(initState);

      const { executeTransationFn } = createMockStateManager<
        MockState,
        MockExecuteTransactionInput
      >();

      getStateDataSpy.mockResolvedValue(undefined);

      await expect(
        executeTransationFn(
          {
            txnHash: 'hash-final',
            id: 'id',
            cnt: 2,
          },
          30,
        ),
      ).rejects.toThrow('Failed to begin transaction');
    });

    it('throws StateError error, if an StateError catched', async () => {
      const initState = {
        transaction: [],
        trasansactionDetails: {},
      };

      const { setStateDataSpy, setStateDataFn, updateDataFn } =
        createMockState(initState);

      const { executeTransationFn, updateDataSpy } = createMockStateManager<
        MockState,
        MockExecuteTransactionInput
      >();

      updateDataSpy.mockImplementation(updateDataFn);

      // firsy mockImplementation is to mock the set data actions
      setStateDataSpy
        .mockImplementationOnce(async () => {
          throw new StateError('setStateDataSpy');
          // second mockImplementation is to mock the rollback actions
        })
        .mockImplementationOnce(setStateDataFn);

      await expect(
        executeTransationFn(
          {
            txnHash: 'hash-final',
            id: 'id',
            cnt: 2,
          },
          30,
        ),
      ).rejects.toThrow(StateError);
    });
  });
});
