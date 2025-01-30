import type { BitcoinAccount, SendForm, SendFormRepository } from '../entities';
import type { SnapClient } from '../entities/snap';
import { v4 } from 'uuid';
import { JSXSendFormAdapter } from '../infra/JSXSendFormAdapter';

export class JSXSendFormRepository implements SendFormRepository {
  readonly #snapClient: SnapClient;

  constructor(snapClient: SnapClient) {
    this.#snapClient = snapClient;
  }

  async insert(account: BitcoinAccount): Promise<SendForm> {
    const id = v4();
    const form = JSXSendFormAdapter.create(id, account);

    const state = await this.#snapClient.get();
    state.interfaces.sendForms[id] = { id };
    await this.#snapClient.set(state);

    return form;
  }
}
