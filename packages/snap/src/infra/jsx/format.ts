import { Amount } from '@metamask/bitcoindevkit';
import type { CurrencyRate } from '@metamask/snaps-sdk';

import type { CurrencyUnit } from '../../entities';

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

export const displayExchangeAmount = (
  amount: bigint,
  exchangeRate?: CurrencyRate,
): string => {
  return exchangeRate
    ? `${((Number(amount) * exchangeRate.conversionRate) / 1e8).toFixed(2)} ${
        exchangeRate.currency
      }`
    : '';
};
