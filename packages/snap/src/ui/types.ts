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

export enum SendFormError {
  InvalidAddress = 'Invalid address',
  InvalidAmount = 'Invalid amount',
  ZeroAmount = 'Amount must be greater than 0',
  InsufficientFunds = 'Insufficient funds',
  TotalExceedsBalance = 'Amount and fees exceeds balance',
  InvalidTotal = 'Invalid total',
  InvalidFees = 'Invalid fees',
}

/**
 * The form errors.
 *
 * @property to - The error for the receiving address.
 * @property amount - The error for the amount.
 * @property total - The error for the total amount.
 * @property fees - The error for the estimated fees.
 */
export type SendFormErrorsObject = {
  to: SendFormError;
  amount: SendFormError;
  total: SendFormError;
  fees: SendFormError;
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
};
