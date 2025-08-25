import type { Network } from '@metamask/bitcoindevkit';
import { Amount, BdkErrorCode } from '@metamask/bitcoindevkit';
import type { CaipAccountId, CurrencyRate } from '@metamask/snaps-sdk';

import {
  ValidationError,
  type CurrencyUnit,
  type Messages,
} from '../../entities';
import { networkToScope } from '../../handlers';
import { METAMASK_ORIGIN } from '../../handlers/permissions';

export const displayAmount = (
  amountSats: bigint,
  currency?: CurrencyUnit,
): string => {
  const amount = Amount.from_sat(amountSats).to_btc();
  if (currency) {
    return `${amount} ${currency}`;
  }

  return amount.toString();
};

export const exchangeAmount = (
  amount: bigint,
  exchangeRate?: CurrencyRate,
): string => {
  if (!exchangeRate) {
    return '';
  }

  return ((Number(amount) * exchangeRate.conversionRate) / 1e8).toFixed(2);
};

export const displayExchangeAmount = (
  amount: bigint,
  exchangeRate?: CurrencyRate,
): string => {
  return exchangeRate
    ? `${exchangeAmount(amount, exchangeRate)} ${exchangeRate.currency}`
    : '';
};

export const translate =
  (messages: Messages) =>
  (key: string): string =>
    messages[key]?.message ?? `{${key}}`;

export const displayExplorerUrl = (url: string, address: string): string =>
  `${url}/address/${address}`;

export const errorCodeToLabel = (code: number): string => {
  const raw = BdkErrorCode[code] as string | undefined;
  if (!raw) {
    return 'unknownError';
  }

  // lowercase the first letter to respect camelCase convention
  return raw.charAt(0).toLowerCase() + raw.slice(1);
};

export const parseOrigin = (origin: string): string => {
  if (origin === METAMASK_ORIGIN) {
    return 'MetaMask';
  }

  try {
    return new URL(origin).hostname;
  } catch (error) {
    throw new ValidationError('Invalid URL', { origin }, error);
  }
};

export const displayCaip10 = (
  network: Network,
  address: string,
): CaipAccountId => {
  return `${networkToScope[network]}:${address}`;
};
