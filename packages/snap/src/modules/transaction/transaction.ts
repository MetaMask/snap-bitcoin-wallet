import { TransactionServiceError } from './exceptions';
import type { TransactionStateManager } from './state';
import type { Balance, ITransactionMgr } from './types';

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

  async getBalance(address: string): Promise<Balance> {
    try {
      const result = await this.transactionMgr.getBalance(address);
      return result;
    } catch (error) {
      throw new TransactionServiceError(error);
    }
  }
}
