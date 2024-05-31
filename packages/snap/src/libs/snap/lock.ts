import { Mutex } from 'async-mutex';

const saveMutex = new Mutex();

export class MutexLock {
  static acquire(create = false) {
    if (create) {
      return new Mutex();
    }
    return saveMutex;
  }
}
