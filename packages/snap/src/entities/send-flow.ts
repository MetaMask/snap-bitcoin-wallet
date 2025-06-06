import type { Network } from '@metamask/bitcoindevkit';
import type { CurrencyRate } from '@metamask/snaps-sdk';

import type { CurrencyUnit } from './currency';

export const SENDFORM_NAME = 'sendForm';

export type SendFormContext = {
  account: {
    id: string;
    address: string; // FIXME: Address should not be needed to identify an account
  };
  network: Network;
  balance: string;
  feeRate: number;
  currency: CurrencyUnit;
  exchangeRate?: CurrencyRate;
  recipient?: string;
  amount?: string;
  fee?: string;
  drain?: boolean;
  errors: {
    tx?: string;
    recipient?: string;
    amount?: string;
  };
  backgroundEventId?: string;
  locale: string;
};

export enum SendFormEvent {
  Amount = 'amount',
  Recipient = 'recipient',
  ClearRecipient = 'clearRecipient',
  ClearAmount = 'clearAmount',
  Confirm = 'confirm',
  Cancel = 'cancel',
  SetMax = 'max',
  SetAccount = 'setAccount',
  SetAsset = 'setAsset',
}

export type SendFormState = {
  recipient: string;
  amount: string;
};

export type ReviewTransactionContext = {
  from: string;
  network: Network;
  currency: CurrencyUnit;
  exchangeRate?: CurrencyRate;
  recipient: string;
  amount: string;
  backgroundEventId?: string;
  locale: string;
  psbt: string;

  /**
   * Used to repopulate the send form if the user decides to go back in the flow
   * Optional when sending directly without form.
   */
  sendForm?: SendFormContext;
};

export enum ReviewTransactionEvent {
  Send = 'send',
  HeaderBack = 'headerBack',
}

/**
 * SendFlowRepository is a repository that manages Bitcoin Send flow interfaces.
 */
export type SendFlowRepository = {
  /**
   * Get the form state.
   *
   * @param id - the interface ID
   * @returns the form state or null
   */
  getState(id: string): Promise<SendFormState | null>;

  /**
   * Get the form context.
   *
   * @param id - the interface ID
   * @returns the form context or null
   */
  getContext(id: string): Promise<SendFormContext | null>;

  /**
   * Insert a new send form interface.
   *
   * @param context - the form context
   * @returns the interface ID
   */
  insertForm(context: SendFormContext): Promise<string>;

  /**
   * Update an interface to the send form view.
   *
   * @param id - the interface ID
   * @param context - the form context
   */
  updateForm(id: string, context: SendFormContext): Promise<void>;

  /**
   * Update an interface to the review transaction view.
   *
   * @param id - the interface ID
   * @param context - the review transaction context
   */
  updateReview(id: string, context: ReviewTransactionContext): Promise<void>;
};
