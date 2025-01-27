import type { SnapClient } from '../../entities';
import { SnapEntropyClientAdapter } from './SnapEntropyClientAdapter';
import { SnapEventEmitterAdapter } from './SnapEventEmitterAdapter';
import { SnapStorageClientAdapter } from './SnapStorageClientAdapter';

export class SnapClientAdapter implements SnapClient {
  readonly #state: SnapStorageClientAdapter;

  readonly #entropy: SnapEntropyClientAdapter;

  readonly #events: SnapEventEmitterAdapter;

  constructor(encrypt = false) {
    this.#state = new SnapStorageClientAdapter(encrypt);
    this.#entropy = new SnapEntropyClientAdapter();
    this.#events = new SnapEventEmitterAdapter();
  }

  get state(): SnapStorageClientAdapter {
    return this.#state;
  }

  get entropy(): SnapEntropyClientAdapter {
    return this.#entropy;
  }

  get events(): SnapEventEmitterAdapter {
    return this.#events;
  }
}
