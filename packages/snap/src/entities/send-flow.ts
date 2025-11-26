import type { Network } from '@metamask/bitcoindevkit';
import type { CurrencyRate } from '@metamask/snaps-sdk';

import type { CurrencyUnit } from './currency';
import type { CodifiedError } from './error';

// TODO: This context will be adjusted to the needs
// of unified send flow.
export type ConfirmSendFormContext = {
  from: string;
  explorerUrl: string;
  network: Network;
  currency: CurrencyUnit;
  exchangeRate?: CurrencyRate;
  recipient: string;
  amount: string;
  backgroundEventId?: string;
  locale: string;
  psbt: string;
  origin?: string;
};

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
    tx?: CodifiedError;
    recipient?: CodifiedError;
    amount?: CodifiedError;
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
  Max = 'max',
  Account = 'account',
  Asset = 'asset',
  SwitchCurrency = 'switchCurrency',
}

export type ReviewTransactionContext = {
  from: string;
  explorerUrl: string;
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
   * Get the form context.
   *
   * @param id - the interface ID
   * @returns the form context
   */
  getContext(id: string): Promise<SendFormContext>;

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

  insertConfirmSendForm(context: ConfirmSendFormContext): Promise<string>;
};
