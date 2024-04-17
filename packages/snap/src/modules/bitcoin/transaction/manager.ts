import type { ITransactionMgr, Balance } from '../../transaction/types';
import { type IReadDataClient } from '../data-client';
import { TransactionError } from './exceptions';
import type { BtcTransactionMgrOptions } from './types';

export class BtcTransactionMgr implements ITransactionMgr {
  protected readonly readClient: IReadDataClient;

  protected readonly options: BtcTransactionMgrOptions;

  constructor(readClient: IReadDataClient, options: BtcTransactionMgrOptions) {
    this.readClient = readClient;
    this.options = options;
  }

  async getBalance(address: string): Promise<Balance> {
    try {
      const response = await this.readClient.getBalance(address);
      return response;
    } catch (error) {
      throw new TransactionError(error);
    }
  }
}
