import type { Psbt } from '@metamask/bitcoindevkit';
import { getCurrentUnixTimestamp } from '@metamask/keyring-snap-sdk';
import type { CurrencyRate } from '@metamask/snaps-sdk';

import type {
  AssetRatesClient,
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

  readonly #ratesClient: AssetRatesClient;

  constructor(
    snapClient: SnapClient,
    translator: Translator,
    chainClient: BlockchainClient,
    ratesClient: AssetRatesClient,
  ) {
    this.#snapClient = snapClient;
    this.#translator = translator;
    this.#chainClient = chainClient;
    this.#ratesClient = ratesClient;
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
    const { locale, currency: fiatCurrency } =
      await this.#snapClient.getPreferences();

    const context: ConfirmSendFormContext = {
      from: account.publicAddress.toString(),
      explorerUrl: this.#chainClient.getExplorerUrl(account.network),
      network: account.network,
      currency: networkToCurrencyUnit[account.network],
      exchangeRate: await this.#getExchangeRate(account.network, fiatCurrency),
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

  async #getExchangeRate(
    network: string,
    currency: string,
  ): Promise<CurrencyRate | undefined> {
    if (network !== 'bitcoin') {
      return undefined;
    }

    try {
      const spotPrice = await this.#ratesClient.spotPrices(currency);

      if (spotPrice.price === undefined || spotPrice.price === null) {
        return undefined;
      }

      return {
        conversionRate: spotPrice.price,
        conversionDate: getCurrentUnixTimestamp(),
        currency: currency.toUpperCase(),
      };
    } catch {
      // Exchange rates are optional display information - don't fail if unavailable
      return undefined;
    }
  }
}
