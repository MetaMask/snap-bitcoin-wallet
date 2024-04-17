import { generateAccounts } from '../../../test/utils';
import { TransactionServiceError } from './exceptions';
import { TransactionStateManager } from './state';
import { TransactionService } from './transaction';
import type { ITransactionMgr } from './types';

describe('TransactionService', () => {
  const createMockTxnMgr = () => {
    const getBalanceSpy = jest.fn();

    class MockTxnMgr implements ITransactionMgr {
      getBalance = getBalanceSpy;
    }
    return {
      instance: new MockTxnMgr(),
      getBalanceSpy,
    };
  };

  describe('getBalance', () => {
    it('calls transactionMgr.getBalance', async () => {
      const { instance, getBalanceSpy } = createMockTxnMgr();
      const accounts = generateAccounts(1);

      const service = new TransactionService(
        instance,
        new TransactionStateManager(),
      );
      await service.getBalance(accounts[0].address);

      expect(getBalanceSpy).toHaveBeenCalledWith(accounts[0].address);
    });

    it('throws TransactionServiceError if transactionMgr.getBalance failed', async () => {
      const { instance, getBalanceSpy } = createMockTxnMgr();
      getBalanceSpy.mockRejectedValue(new Error('error'));
      const accounts = generateAccounts(1);

      let expectedError;
      try {
        const service = new TransactionService(
          instance,
          new TransactionStateManager(),
        );
        await service.getBalance(accounts[0].address);
      } catch (error) {
        expectedError = error;
      } finally {
        expect(expectedError).toBeInstanceOf(TransactionServiceError);
      }
    });
  });
});
