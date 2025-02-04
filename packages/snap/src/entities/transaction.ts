export type TransactionRequest = {
  recipient: string;
  amount?: string;
  feeRate: number;
};
