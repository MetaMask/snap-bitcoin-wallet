import type { Utxo } from '../../chain';
import { type Balances } from '../../chain';

export type IReadDataClient = {
  getBalances(address: string[]): Promise<Balances>;
  getUtxos(address: string, includeUnconfirmed?: boolean): Promise<Utxo[]>;
};

export type IWriteDataClient = {
  sendTransaction(tx: string): Promise<void>;
};

export type IDataClient = IReadDataClient & IWriteDataClient;
