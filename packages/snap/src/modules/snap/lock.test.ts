import { expect } from '@jest/globals';
import { Mutex } from 'async-mutex';

import { MutexLock } from './lock';

jest.mock('async-mutex', () => {
  return {
    Mutex: jest.fn(),
  };
});

describe('MutexLock', () => {
  describe('acquire', () => {
    it('acquires lock', () => {
      MutexLock.acquire();
      expect(Mutex).toHaveBeenCalledTimes(0);
    });

    it('acquires new lock if parameter `create` is true', () => {
      MutexLock.acquire(true);
      expect(Mutex).toHaveBeenCalledTimes(1);
    });
  });
});
