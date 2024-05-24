import type { Json } from '@metamask/snaps-sdk';

export enum FeeRatio {
  Fast = 'fast',
  Medium = 'medium',
  Slow = 'slow',
}

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

export type TransactionIntent = {
  amounts: Record<string, number>;
  subtractFeeFrom: string[];
  replaceable: boolean;
};

export type TransactionData = {
  data: Record<string, Json>;
};

export type Pagination = {
  limit: number;
  offset: number;
};

export type IOnChainService = {
  getBalances(addresses: string[], assets: string[]): Promise<AssetBalances>;
  estimateFees(): Promise<Fees>;
  boardcastTransaction(signedTransaction: string): Promise<string>;
  listTransactions(address: string, pagination: Pagination);
  getTransaction(txnHash: string);
  getDataForTransaction(
    address: string,
    transactionIntent?: TransactionIntent,
  ): Promise<TransactionData>;
};
