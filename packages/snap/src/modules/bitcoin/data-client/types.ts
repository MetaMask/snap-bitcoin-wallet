import { type Balances } from '../../transaction';

export type IReadDataClient = {
  getBalances(address: string[]): Promise<Balances>;
};

export type IWriteDataClient = {
  sendTransaction(tx: string): Promise<void>;
};

export type IDataClient = IReadDataClient & IWriteDataClient;
