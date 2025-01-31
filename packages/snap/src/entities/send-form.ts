import type { BitcoinAccount } from './account';
import { CurrencyUnit } from './currency';
import type { UserInterface } from './ui';

export type SendForm = UserInterface & {
  context: SendFormContext;
};

export type SendFormContext = {
  account: string;
  fiatRate?: number;
  currency: CurrencyUnit;
  request: {
    recipient?: string;
    amount?: number;
    feeRate?: number;
  };
};

export enum SendFormEvent {
  Amount = 'amount',
  To = 'to',
  SwapCurrencyDisplay = 'swap',
  AccountSelector = 'accountSelector',
  Clear = 'clear',
  Close = 'close',
  Review = 'review',
  Cancel = 'cancel',
  HeaderBack = 'headerBack',
  SetMax = 'max',
}

/**
 * SendFormRepository is a repository that manages Bitcoin Send forms.
 */
export type SendFormRepository = {
  /**
   * Insert a new form interface.
   * @param account - the Bitcoin account tied to the form
   * @param context - the form context
   * @returns the form ID
   */
  insert(account: BitcoinAccount, context: SendFormContext): Promise<string>;

  /**
   * Updates a form interface with an account and context
   * @param id - the form ID
   * @param account - the Bitcoin account tied to the form
   * @param context - the form context
   */
  update(
    id: string,
    account: BitcoinAccount,
    context: SendFormContext,
  ): Promise<void>;
};
