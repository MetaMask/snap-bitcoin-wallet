import type { FeeRatio } from '../../transaction';
import { type Balances } from '../../transaction';

export type GetFeeRatesResp = {
  [key in FeeRatio]?: number;
};

export type IReadDataClient = {
  getBalances(address: string[]): Promise<Balances>;
  getFeeRates(): Promise<GetFeeRatesResp>;
};

export type IWriteDataClient = {
  sendTransaction(tx: string): Promise<void>;
};

export type IDataClient = IReadDataClient & IWriteDataClient;
