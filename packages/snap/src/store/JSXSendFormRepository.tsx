import {
  SENDFORM_NAME,
  type SendFormContext,
  type SendFormRepository,
  type SendFormState,
} from '../entities';
import type { SnapClient } from '../entities/snap';
import { SendFormView } from '../infra/jsx';

export class JSXSendFormRepository implements SendFormRepository {
  readonly #snapClient: SnapClient;

  constructor(snapClient: SnapClient) {
    this.#snapClient = snapClient;
  }

  async getState(id: string): Promise<SendFormState> {
    const state = await this.#snapClient.getInterfaceState<SendFormState>(
      id,
      SENDFORM_NAME,
    );
    // This should never fail by assertion so returning an error here should not be necessary.
    // We are adding this check to avoid developer mistakes but this should be tested in integration tests.
    if (!state) {
      throw new Error('Missing state from Send Form');
    }

    return state;
  }

  async insert(context: SendFormContext): Promise<string> {
    return this.#snapClient.createInterface(
      <SendFormView {...context} />,
      context,
    );
  }

  async update(id: string, context: SendFormContext): Promise<void> {
    return this.#snapClient.updateInterface(
      id,
      <SendFormView {...context} />,
      context,
    );
  }
}
