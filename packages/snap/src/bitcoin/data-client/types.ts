import type { Balances, FeeRatio, TransactionStatusData } from '../../chain';
import type { Utxo } from '../wallet';

export type GetFeeRatesResp = {
  [key in FeeRatio]?: number;
};

export type IReadDataClient = {
  getBalances(address: string[]): Promise<Balances>;
  getUtxos(address: string, includeUnconfirmed?: boolean): Promise<Utxo[]>;
  getFeeRates(): Promise<GetFeeRatesResp>;
  getTransactionStatus(txHash: string): Promise<TransactionStatusData>;
};

export type IWriteDataClient = {
  sendTransaction(tx: string): Promise<string>;
};

export type IDataClient = IReadDataClient & IWriteDataClient;
