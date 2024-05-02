import { type Balances } from '../../chain';

export type Utxo = {
  block: number;
  txnHash: string;
  index: number;
  value: number;
};

export type IReadDataClient = {
  getBalances(address: string[]): Promise<Balances>;
  getUtxos(address: string): Promise<Utxo[]>;
};

export type IWriteDataClient = {
  sendTransaction(tx: string): Promise<void>;
};

export type IDataClient = IReadDataClient & IWriteDataClient;
