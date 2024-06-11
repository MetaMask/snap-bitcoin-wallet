import type { FeeRatio, TransactionStatusData } from '../../chain';
import type { Utxo } from '../../wallet';

export type GetBalancesResp = Record<string, number>;

export type GetFeeRatesResp = {
  [key in FeeRatio]?: number;
};

export type IDataClient = {
  getBalances(address: string[]): Promise<GetBalancesResp>;
  getUtxos(address: string, includeUnconfirmed?: boolean): Promise<Utxo[]>;
  getFeeRates(): Promise<GetFeeRatesResp>;
  getTransactionStatus(txHash: string): Promise<TransactionStatusData>;
  sendTransaction(tx: string): Promise<string>;
};
