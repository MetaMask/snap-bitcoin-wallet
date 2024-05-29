import type { Json } from '@metamask/snaps-sdk';
import type { Infer } from 'superstruct';
import { object, define, string, array, boolean } from 'superstruct';

const transactionIntentAmts = () =>
  define<Record<string, number>>(
    'transactionIntentAmts',
    (value: Record<string, number>) => {
      if (Object.entries(value).length === 0) {
        return 'Transaction must have at least one recipient';
      }

      for (const val of Object.values(value)) {
        if (val <= 0) {
          return 'Invalid amount for send';
        }
      }

      return true;
    },
  );

export enum FeeRatio {
  Fast = 'fast',
  Medium = 'medium',
  Slow = 'slow',
}

export enum TransactionStatus {
  Confirmed = 'confirmed',
  Pending = 'pending',
  Failed = 'failed',
}

export type TransactionStatusData = {
  status: TransactionStatus;
  confirmations: number;
};

export type Balances = Record<string, number>;

export type Balance = {
  amount: number;
};

export type AssetBalances = {
  balances: {
    [address: string]: {
      [asset: string]: Balance;
    };
  };
};

export type Fee = {
  type: FeeRatio;
  rate: number;
};

export type Fees = {
  fees: Fee[];
};

export const TransactionIntentStruct = object({
  amounts: transactionIntentAmts(),
  subtractFeeFrom: array(string()),
  replaceable: boolean(),
});

export type TransactionIntent = Infer<typeof TransactionIntentStruct>;

export type TransactionData = {
  data: Record<string, Json>;
};

export type Pagination = {
  limit: number;
  offset: number;
};

export type CommitedTransaction = {
  transactionId: string;
};

export type IOnChainService = {
  getBalances(addresses: string[], assets: string[]): Promise<AssetBalances>;
  estimateFees(): Promise<Fees>;
  broadcastTransaction(signedTransaction: string): Promise<CommitedTransaction>;
  listTransactions(address: string, pagination: Pagination);
  getTransactionStatus(txnHash: string): Promise<TransactionStatusData>;
  getDataForTransaction(
    address: string,
    transactionIntent?: TransactionIntent,
  ): Promise<TransactionData>;
};
