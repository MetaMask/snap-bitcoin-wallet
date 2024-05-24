import type { Balances, FeeRatio, Utxo } from '../../chain';

export type GetFeeRatesResp = {
  [key in FeeRatio]?: number;
};

export type IReadDataClient = {
  getBalances(address: string[]): Promise<Balances>;
  getUtxos(address: string, includeUnconfirmed?: boolean): Promise<Utxo[]>;
  getFeeRates(): Promise<GetFeeRatesResp>;
};

export type IWriteDataClient = {
  sendTransaction(tx: string): Promise<string>;
};

export type IDataClient = IReadDataClient & IWriteDataClient;
