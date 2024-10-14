import type { KeyringAccount } from '@metamask/keyring-api';

import type { SendFlowRequest } from '../stateManagement';

/**
 * The state of the send form.
 *
 * @property to - The receiving address.
 * @property amount - The amount to send.
 * @property accountSelector - The selected account.
 */
export type SendFormState = {
  to: string;
  amount: string;
  accountSelector: string;
};

/**
 * The form errors.
 *
 * @property to - The error for the receiving address.
 * @property amount - The error for the amount.
 * @property total - The error for the total amount.
 * @property fees - The error for the estimated fees.
 */
export type SendFormErrors = {
  to: string;
  amount: string;
  total: string;
  fees: string;
};

/**
 * A currency value.
 *
 * @property amount - The amount in the selected currency.
 * @property fiat - The amount in fiat currency.
 */
export type Currency = {
  amount: string;
  fiat: string;
};

/**
 * The context of the send flow interface.
 *
 * @property accounts - The available accounts.
 * @property fees - The fees for the transaction.
 * @property requestId - The ID of the send flow request. 
 */
export type SendFlowContext = {
  accounts: AccountWithBalance[];
  scope: string;
  requestId: string;
};

export type AccountWithBalance = KeyringAccount & { balance?: Currency };

export enum AssetType {
  BTC = 'BTC',
  FIAT = '$',
}

export type GenerateSendFlowParams = {
  account: KeyringAccount;
  scope: string;
};

export type UpdateSendFlowParams = {
  request: SendFlowRequest;
  flushToAddress?: boolean;
  currencySwitched?: boolean;
  backEventTriggered?: boolean;
  showReviewTransaction?: boolean;
};
