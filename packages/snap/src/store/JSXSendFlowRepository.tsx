import type {
  SendFormContext,
  SendFlowRepository,
  SendFormState,
  SnapClient,
  ReviewTransactionContext,
  Translator,
} from '../entities';
import { SENDFORM_NAME } from '../entities';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';

export class JSXSendFlowRepository implements SendFlowRepository {
  readonly #snapClient: SnapClient;

  readonly #translator: Translator;

  constructor(snapClient: SnapClient, translator: Translator) {
    this.#snapClient = snapClient;
    this.#translator = translator;
  }

  async getState(id: string): Promise<SendFormState | null> {
    const state = await this.#snapClient.getInterfaceState(id);
    if (!state) {
      return null;
    }

    return (state[SENDFORM_NAME] as SendFormState) ?? null;
  }

  async getContext(id: string): Promise<SendFormContext | null> {
    return (await this.#snapClient.getInterfaceContext(
      id,
    )) as SendFormContext | null;
  }

  async insertForm(context: SendFormContext): Promise<string> {
    await this.#translator.load(context.locale);
    return this.#snapClient.createInterface(
      <SendFormView context={context} messages={this.#translator.messages} />,
      context,
    );
  }

  async updateForm(id: string, context: SendFormContext): Promise<void> {
    await this.#translator.load(context.locale);
    return this.#snapClient.updateInterface(
      id,
      <SendFormView context={context} messages={this.#translator.messages} />,
      context,
    );
  }

  async updateReview(
    id: string,
    context: ReviewTransactionContext,
  ): Promise<void> {
    await this.#translator.load(context.locale);
    return this.#snapClient.updateInterface(
      id,
      <ReviewTransactionView
        context={context}
        messages={this.#translator.messages}
      />,
      context,
    );
  }
}
