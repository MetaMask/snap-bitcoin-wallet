import type {
  BitcoinAccount,
  SendFormContext,
  SendFormRepository,
} from '../entities';
import type { SnapClient } from '../entities/snap';
import { JSXSendFormAdapter } from '../infra/JSXSendFormAdapter';

export class JSXSendFormRepository implements SendFormRepository {
  readonly #snapClient: SnapClient;

  constructor(snapClient: SnapClient) {
    this.#snapClient = snapClient;
  }

  async insert(
    account: BitcoinAccount,
    context: SendFormContext,
  ): Promise<string> {
    const form = JSXSendFormAdapter.create(account, context);
    return await this.#snapClient.createInterface(form);
  }

  async update(
    id: string,
    account: BitcoinAccount,
    context: SendFormContext,
  ): Promise<void> {
    const form = JSXSendFormAdapter.create(account, context);
    await this.#snapClient.updateInterface(id, form);
  }
}
