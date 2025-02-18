import type { CurrencyRate } from '@metamask/snaps-sdk';

import type {
  SendFormContext,
  SendFlowRepository,
  SendFormState,
  SnapClient,
  ReviewTransactionContext,
  BitcoinAccount,
} from '../entities';
import { networkToCurrencyUnit, SENDFORM_NAME } from '../entities';
import { ReviewTransactionView, SendFormView } from '../infra/jsx';

export class JSXSendFlowRepository implements SendFlowRepository {
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

  async insertForm(
    account: BitcoinAccount,
    feeRate: number,
    fiatRate?: CurrencyRate,
  ): Promise<string> {
    const context: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      currency: networkToCurrencyUnit[account.network],
      account: { id: account.id, address: account.peekAddress(0).address }, // FIXME: Address should not be needed here
      network: account.network,
      feeRate,
      fiatRate,
      errors: {},
    };

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
