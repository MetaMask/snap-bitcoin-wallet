import type { FeeRatio, TransactionStatus } from './constants';

export type TransactionStatusData = {
  status: TransactionStatus;
};

export type Balance = {
  amount: bigint;
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
  rate: bigint;
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
  data: {
    utxos: Utxo[];
  };
};

export type CommitedTransaction = {
  transactionId: string;
};

export type Utxo = {
  block: number;
  txHash: string;
  index: number;
  value: number;
};

export type DataClientGetBalancesResp = Record<string, number>;

export type DataClientGetUtxosResp = Utxo[];

export type DataClientGetFeeRatesResp = {
  [key in FeeRatio]?: number;
};

export type DataClientGetTxStatusResp = TransactionStatusData;

export type DataClientSendTxResp = string;

export type IDataClient = {
  getBalances(address: string[]): Promise<DataClientGetBalancesResp>;
  getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<DataClientGetUtxosResp>;
  getFeeRates(): Promise<DataClientGetFeeRatesResp>;
  getTransactionStatus(txHash: string): Promise<DataClientGetTxStatusResp>;
  sendTransaction(tx: string): Promise<DataClientSendTxResp>;
};
