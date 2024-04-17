import type { Mutex } from 'async-mutex';

import { SnapHelper } from './helpers';
import { MutexLock } from './lock';

export abstract class SnapStateManager<State> {
  protected readonly mtx: Mutex;

  constructor(createLock = false) {
    this.mtx = MutexLock.acquire(createLock);
  }

  protected async get(): Promise<State> {
    return SnapHelper.getStateData<State>();
  }

  protected async set(state: State): Promise<void> {
    return SnapHelper.setStateData<State>(state);
  }

  protected async update(
    update: (state: State) => Promise<void>,
  ): Promise<void> {
    return this.mtx.runExclusive(async () => {
      const state = await this.get();
      await update(state);
      await this.set(state);
    });
  }
}
