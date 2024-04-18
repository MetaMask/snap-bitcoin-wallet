import { expect } from '@jest/globals';

import { SnapHelper } from './helpers';
import { MutexLock } from './lock';
import { SnapStateManager } from './state';

describe('SnapStateManager', () => {
  const createMockStateManager = (createLock?: boolean) => {
    const updateDataSpy = jest.fn();
    class MockSnapStateManager extends SnapStateManager<any> {
      constructor() {
        super(createLock);
      }

      async getData() {
        return this.get();
      }

      async updateData(data: any) {
        await this.update(async (state) => updateDataSpy(state, data));
      }
    }

    return {
      instance: new MockSnapStateManager(),
      updateDataSpy,
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
});
