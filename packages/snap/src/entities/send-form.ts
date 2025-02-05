import type { Network } from 'bitcoindevkit';

import type { CurrencyUnit } from './currency';
import { BitcoinAccount } from './account';

export const SENDFORM_NAME = 'sendForm';

export type SendFormContext = {
  account: string;
  network: Network;
  balance: string;
  feeRate: number;
  currency: CurrencyUnit;
  fiatRate?: number;
  recipient?: string;
  amount?: string;
  fee?: string;
  drain?: boolean;
  errors: {
    tx?: string;
    recipient?: string;
    amount?: string;
  };
};

export enum SendFormEvent {
  Amount = 'amount',
  Recipient = 'recipient',
  SwapCurrency = 'swap',
  AccountSelector = 'accountSelector',
  ClearRecipient = 'clearRecipient',
  Review = 'review',
  Cancel = 'cancel',
  HeaderBack = 'headerBack',
  SetMax = 'max',
}

export type SendFormState = {
  recipient: string;
  amount: string;
};

/**
 * SendFormRepository is a repository that manages Bitcoin Send forms.
 */
export type SendFormRepository = {
  /**
   * Get the form state.
   * @param id - the form ID
   * @returns the form state
   */
  getState(id: string): Promise<SendFormState>;

  /**
   * Insert a new form interface.
   * @param context - the form context
   * @returns the form ID
   */
  insert(account: BitcoinAccount, feeRate: number): Promise<string>;

  /**
   * Updates a form interface with an account and context
   * @param id - the form ID
   * @param context - the form context
   */
  update(id: string, context: SendFormContext): Promise<void>;
};
