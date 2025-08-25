import type {
  BitcoinAccount,
  ConfirmationRepository,
  SignMessageConfirmationContext,
  SnapClient,
  Translator,
} from '../entities';
import { UserActionError } from '../entities';
import { SignMessageConfirmationView } from '../infra/jsx';

export class JSXConfirmationRepository implements ConfirmationRepository {
  readonly #snapClient: SnapClient;

  readonly #translator: Translator;

  constructor(snapClient: SnapClient, translator: Translator) {
    this.#snapClient = snapClient;
    this.#translator = translator;
  }

  async insertSignMessage(
    account: BitcoinAccount,
    message: string,
    origin: string,
  ): Promise<void> {
    const { locale } = await this.#snapClient.getPreferences();
    const context: SignMessageConfirmationContext = {
      message,
      origin,
      account: {
        id: account.id,
        address: account.publicAddress.toString(), // FIXME: Address should not be needed in the send flow
      },
      network: account.network,
    };

    const messages = await this.#translator.load(locale);
    const interfaceId = await this.#snapClient.createInterface(
      <SignMessageConfirmationView context={context} messages={messages} />,
      context,
    );

    // Blocks and waits for user actions. This logic can live here instead of in the use case
    // because it's common to all confirmations. Move to use case if needed.
    const confirmed =
      await this.#snapClient.displayInterface<boolean>(interfaceId);
    if (!confirmed) {
      throw new UserActionError('User canceled the confirmation');
    }
  }
}
