import type {
  BitcoinAccount,
  SendForm,
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
  ): Promise<SendForm> {
    const form = JSXSendFormAdapter.create(account, context);
    form.id = await this.#snapClient.createInterface(form);
    return form;
  }
}
