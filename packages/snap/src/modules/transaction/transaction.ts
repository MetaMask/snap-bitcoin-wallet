import { TransactionServiceError } from './exceptions';
import type { TransactionStateManager } from './state';
import type { AssetBalances, ITransactionMgr } from './types';

// Keep this class until we dont need to using state to manage transaction
export class TransactionService {
  protected readonly transactionMgr: ITransactionMgr;

  protected readonly transactionStateManager: TransactionStateManager;

  constructor(
    transactionMgr: ITransactionMgr,
    transactionStateManager: TransactionStateManager,
  ) {
    this.transactionMgr = transactionMgr;
    this.transactionStateManager = transactionStateManager;
  }

  async getBalances(
    addresses: string[],
    assets: string[],
  ): Promise<AssetBalances> {
    try {
      const result = await this.transactionMgr.getBalances(addresses, assets);
      return result;
    } catch (error) {
      throw new TransactionServiceError(error);
    }
  }
}
