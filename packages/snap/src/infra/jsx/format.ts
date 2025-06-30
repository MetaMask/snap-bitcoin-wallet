import { Amount, BdkErrorCode } from '@metamask/bitcoindevkit';
import type { CurrencyRate } from '@metamask/snaps-sdk';

import type { CreateTxError, CurrencyUnit, Messages } from '../../entities';

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

export const errorCodeToLabel = (code: CreateTxError['code']): string => {
  if (code === 'unknown') return 'unknownError';

  const raw = BdkErrorCode[code] as string | undefined;
  if (!raw) return 'unknownError';

  return raw.charAt(0).toLowerCase() + raw.slice(1);
};
