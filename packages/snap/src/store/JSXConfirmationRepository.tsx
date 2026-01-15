import type { Psbt } from '@metamask/bitcoindevkit';

import type {
  BitcoinAccount,
  BlockchainClient,
  ConfirmationRepository,
  ConfirmSendFormContext,
  SignMessageConfirmationContext,
  SnapClient,
  Translator,
} from '../entities';
import { networkToCurrencyUnit, UserActionError } from '../entities';
import { SignMessageConfirmationView } from '../infra/jsx';
import { UnifiedSendFormView } from '../infra/jsx/unified-send-flow';

export class JSXConfirmationRepository implements ConfirmationRepository {
  readonly #snapClient: SnapClient;

  readonly #translator: Translator;

  readonly #chainClient: BlockchainClient;

  constructor(
    snapClient: SnapClient,
    translator: Translator,
    chainClient: BlockchainClient,
  ) {
    this.#snapClient = snapClient;
    this.#translator = translator;
    this.#chainClient = chainClient;
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
      await this.#snapClient.displayConfirmation<boolean>(interfaceId);
    if (!confirmed) {
      throw new UserActionError('User canceled the confirmation');
    }
  }

  async insertSendTransfer(
    account: BitcoinAccount,
    psbt: Psbt,
    recipient: { address: string; amount: string },
    origin: string,
  ): Promise<void> {
    const { locale } = await this.#snapClient.getPreferences();

    const context: ConfirmSendFormContext = {
      from: account.publicAddress.toString(),
      explorerUrl: this.#chainClient.getExplorerUrl(account.network),
      network: account.network,
      currency: networkToCurrencyUnit[account.network],
      exchangeRate: undefined,
      recipient: recipient.address,
      amount: recipient.amount,
      locale,
      psbt: psbt.toString(),
      origin,
    };

    const messages = await this.#translator.load(locale);
    const interfaceId = await this.#snapClient.createInterface(
      <UnifiedSendFormView context={context} messages={messages} />,
      context,
    );

    const confirmed =
      await this.#snapClient.displayConfirmation<boolean>(interfaceId);
    if (!confirmed) {
      throw new UserActionError('User canceled the confirmation');
    }
  }
}
