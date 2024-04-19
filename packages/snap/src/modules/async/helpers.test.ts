import { expect, jest } from '@jest/globals';

import { AsyncHelper } from './helpers';

describe('AsyncHelper', function () {
  describe('processBatch', function () {
    it('processes the array in batch', async function () {
      const fn = jest.fn() as any;
      const mockArr = new Array(99).fill(0);

      await AsyncHelper.processBatch<number>(mockArr, fn);
      expect(fn).toHaveBeenCalledTimes(mockArr.length);
    });
  });
});
