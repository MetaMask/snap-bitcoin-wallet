import { type Balance } from '../../transaction';

export type IReadDataClient = {
  getBalance(address: string): Promise<Balance>;
};

export type IWriteDataClient = {
  sendTransaction(tx: string): Promise<void>;
};

export type IDataClient = IReadDataClient & IWriteDataClient;
