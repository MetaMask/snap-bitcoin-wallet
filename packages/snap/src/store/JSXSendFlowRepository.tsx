import type {
  SendFormContext,
  SendFlowRepository,
  SnapClient,
  ReviewTransactionContext,
  Translator,
} from '../entities';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';

export class JSXSendFlowRepository implements SendFlowRepository {
  readonly #snapClient: SnapClient;

  readonly #translator: Translator;

  constructor(snapClient: SnapClient, translator: Translator) {
    this.#snapClient = snapClient;
    this.#translator = translator;
  }

  async getContext(id: string): Promise<SendFormContext | null> {
    return (await this.#snapClient.getInterfaceContext(
      id,
    )) as SendFormContext | null;
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
}
