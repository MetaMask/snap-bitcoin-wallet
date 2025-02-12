import type { CurrencyRate } from '@metamask/snaps-sdk';
import { Amount } from 'bitcoindevkit';

import type { CurrencyUnit } from '../../entities';

export const displayAmount = (
  amountSats: bigint,
  currency: CurrencyUnit,
): string => {
  return `${Amount.from_sat(amountSats).to_btc()} ${currency}`;
};

export const displayFiatAmount = (
  amount: bigint,
  fiatRate?: CurrencyRate,
): string => {
  return fiatRate
    ? `${((Number(amount) * fiatRate.conversionRate) / 1e8).toFixed(2)} ${
        fiatRate.currency
      }`
    : '';
};
