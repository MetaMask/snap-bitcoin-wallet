import type {
  SendFormContext,
  SendFlowRepository,
  SendFormState,
  SnapClient,
  ReviewTransactionContext,
} from '../entities';
import { SENDFORM_NAME } from '../entities';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';

export class JSXSendFlowRepository implements SendFlowRepository {
  readonly #snapClient: SnapClient;

  constructor(snapClient: SnapClient) {
    this.#snapClient = snapClient;
  }

  async getState(id: string): Promise<SendFormState | null> {
    const state = await this.#snapClient.getInterfaceState(id);
    if (!state) {
      return null;
    }

    return (state[SENDFORM_NAME] as SendFormState) ?? null;
  }

  async getContext(id: string): Promise<SendFormContext | null> {
    try {
      return (await this.#snapClient.getInterfaceContext(
        id,
      )) as SendFormContext;
    } catch (error) {
      // TODO: Use error type instead when one is available.
      if (error.message === `Interface with id '${id}' not found.`) {
        return null;
      }
      throw error;
    }
  }

  async insertForm(context: SendFormContext): Promise<string> {
    return this.#snapClient.createInterface(
      <SendFormView {...context} />,
      context,
    );
  }

  async updateForm(id: string, context: SendFormContext): Promise<void> {
    return this.#snapClient.updateInterface(
      id,
      <SendFormView {...context} />,
      context,
    );
  }

  async updateReview(
    id: string,
    context: ReviewTransactionContext,
  ): Promise<void> {
    return this.#snapClient.updateInterface(
      id,
      <ReviewTransactionView {...context} />,
      context,
    );
  }
}
