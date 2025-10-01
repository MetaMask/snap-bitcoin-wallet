import {
  type UnifiedSendFormContext,
  type SendFormContext,
  type SendFlowRepository,
  type SnapClient,
  type ReviewTransactionContext,
  type Translator,
  AssertionError,
} from '../entities';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';
import { UnifiedSendFormView } from '../infra/jsx/unified-send-flow';

export class JSXSendFlowRepository implements SendFlowRepository {
  readonly #snapClient: SnapClient;

  readonly #translator: Translator;

  constructor(snapClient: SnapClient, translator: Translator) {
    this.#snapClient = snapClient;
    this.#translator = translator;
  }

  async getContext(id: string): Promise<SendFormContext> {
    const context = await this.#snapClient.getInterfaceContext(id);
    if (!context) {
      throw new AssertionError('Missing context in send flow interface');
    }

    return context as SendFormContext;
  }

  async insertForm(context: SendFormContext): Promise<string> {
    const messages = await this.#translator.load(context.locale);
    return this.#snapClient.createInterface(
      <SendFormView context={context} messages={messages} />,
      context,
    );
  }

  async updateForm(id: string, context: SendFormContext): Promise<void> {
    const messages = await this.#translator.load(context.locale);
    return this.#snapClient.updateInterface(
      id,
      <SendFormView context={context} messages={messages} />,
      context,
    );
  }

  async updateReview(
    id: string,
    context: ReviewTransactionContext,
  ): Promise<void> {
    const messages = await this.#translator.load(context.locale);
    return this.#snapClient.updateInterface(
      id,
      <ReviewTransactionView context={context} messages={messages} />,
      context,
    );
  }

  async insertUnifiedSendForm(
    context: UnifiedSendFormContext,
  ): Promise<string> {
    const messages = await this.#translator.load(context.locale);

    return await this.#snapClient.createInterface(
      <UnifiedSendFormView context={context} messages={messages} />,
      context,
    );
  }

  async updateUnifiedSendForm(
    id: string,
    context: UnifiedSendFormContext,
  ): Promise<void> {
    const messages = await this.#translator.load(context.locale);
    return this.#snapClient.updateInterface(
      id,
      <UnifiedSendFormView context={context} messages={messages} />,
      context,
    );
  }
}
