import type { BitcoinAccount } from '../entities';
import {
  networkToCurrencyUnit,
  SENDFORM_NAME,
  type SendFormContext,
  type SendFormRepository,
  type SendFormState,
  type SnapClient,
} from '../entities';
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
    // Should never occur by assertion. It is a critical inconsistent state error that should be caught in integration tests
    if (!state) {
      throw new Error('Missing state from Send Form');
    }

    return state;
  }

  async insert(account: BitcoinAccount, feeRate: number): Promise<string> {
    const currency = networkToCurrencyUnit[account.network];
    const context: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      currency,
      account: account.id,
      network: account.network,
      feeRate,
      errors: {},
    };

    // TODO: Fetch fiat/fee rates from state
    const fiatRate = await this.#snapClient.getCurrencyRate(currency);
    if (fiatRate) {
      context.fiatRate = fiatRate;
    }

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
