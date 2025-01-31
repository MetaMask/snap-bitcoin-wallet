import { Amount, FeeRate, Recipient } from 'bitcoindevkit';

export type TransactionRequest = {
  recipients: Recipient[];
  amount: Amount;
  feeRate: FeeRate;
};
