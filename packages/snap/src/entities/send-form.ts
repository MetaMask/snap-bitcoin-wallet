import type { BitcoinAccount } from './account';
import type { UserInterface } from './ui';

export type SendForm = UserInterface & {
  context: SendFormContext;
};

export type SendFormContext = {
  account: string;
  fiatRate?: number;
  recipient?: string;
  amount?: number;
  feeRate?: number;
};

export enum SendFormEvents {
  Amount = 'amount',
  To = 'to',
  SwapCurrencyDisplay = 'swap',
  AccountSelector = 'accountSelector',
  Clear = 'clear',
  Close = 'close',
  Review = 'review',
  Cancel = 'cancel',
  Send = 'send',
  HeaderBack = 'headerBack',
  SetMax = 'max',
}

/**
 * SendFormRepository is a repository that manages Bitcoin Send forms.
 */
export type SendFormRepository = {
  /**
   * Insert a new form.
   * @param account - the Bitcoin account tied to the form
   * @param context - the form context
   * @returns the new Send form
   */
  insert(account: BitcoinAccount, context: SendFormContext): Promise<SendForm>;
};
