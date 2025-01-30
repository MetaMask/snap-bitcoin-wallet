import { BitcoinAccount } from './account';
import { UserInterface } from './ui';

export type SendForm = UserInterface & {};

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
   * @param account the Bitcoin account tied to the form
   * @returns the new form
   */
  insert(account: BitcoinAccount): Promise<SendForm>;
};
