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

  async insertForm(account: BitcoinAccount, feeRate: number): Promise<string> {
    const context: SendFormContext = {
      balance: account.balance.trusted_spendable.to_sat().toString(),
      currency: networkToCurrencyUnit[account.network],
      account: { id: account.id, address: account.peekAddress(0).address }, // FIXME: Address should not be needed here
      network: account.network,
      feeRate,
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
