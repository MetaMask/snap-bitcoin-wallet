import type { Network } from '@metamask/bitcoindevkit';
import type { CurrencyRate } from '@metamask/snaps-sdk';

import type { CurrencyUnit } from './currency';
import type { CodifiedError } from './error';

// TODO: This context will be adjusted to the needs
// of unified send flow.
export type UnifiedSendFormContext = {
  account: {
    id: string;
    address: string;
  };
  network: Network;
  balance: string;
  feeRate: number;
  currency: CurrencyUnit;
  exchangeRate?: CurrencyRate;
  recipient?: string;
  amount?: string;
  fee?: string;
  drain?: boolean;
  errors: {
    tx?: CodifiedError;
    recipient?: CodifiedError;
    amount?: CodifiedError;
  };
  backgroundEventId?: string;
  locale: string;
};
