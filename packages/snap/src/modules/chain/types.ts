import type { FeeRatio } from './constants';

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

export type Utxo = {
  block: number;
  txnHash: string;
  index: number;
  value: number;
};

export type TransactionData = {
  data: {
    utxos: Utxo[];
  };
};

export type Pagination = {
  limit: number;
  offset: number;
};

export type IOnChainService = {
  getBalances(addresses: string[], assets: string[]): Promise<AssetBalances>;
  estimateFees(): Promise<Fees>;
  boardcastTransaction(txn: string);
  listTransactions(address: string, pagination: Pagination);
  getTransaction(txnHash: string);
  getDataForTransaction(
    address: string,
    transactionIntent?: TransactionIntent,
  ): Promise<TransactionData>;
};
