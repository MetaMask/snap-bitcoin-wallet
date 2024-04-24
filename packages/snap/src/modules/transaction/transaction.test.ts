import { generateAccounts } from '../../../test/utils';
import { BtcAsset } from '../bitcoin/config';
import { TransactionServiceError } from './exceptions';
import { TransactionStateManager } from './state';
import { TransactionService } from './transaction';
import type { ITransactionMgr } from './types';

describe('TransactionService', () => {
  const createMockTxnMgr = () => {
    const getBalancesSpy = jest.fn();
    const getFeeRatesSpy = jest.fn();
    class MockTxnMgr implements ITransactionMgr {
      getBalances = getBalancesSpy;

      getFeeRates = getFeeRatesSpy;
    }
    return {
      instance: new MockTxnMgr(),
      getBalancesSpy,
      getFeeRatesSpy,
    };
  };

  describe('getBalance', () => {
    it('calls getBalances with transactionMgr', async () => {
      const { instance, getBalancesSpy } = createMockTxnMgr();
      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);

      const service = new TransactionService(
        instance,
        new TransactionStateManager(),
      );
      await service.getBalances(addresses, [BtcAsset.TBtc]);

      expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [BtcAsset.TBtc]);
    });

    it('throws TransactionServiceError if getBalances failed', async () => {
      const { instance, getBalancesSpy } = createMockTxnMgr();
      getBalancesSpy.mockRejectedValue(new Error('error'));
      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);

      const service = new TransactionService(
        instance,
        new TransactionStateManager(),
      );

      await expect(
        service.getBalances(addresses, [BtcAsset.TBtc]),
      ).rejects.toThrow(TransactionServiceError);
    });
  });

  describe('estimateFees', () => {
    it('calls estimateFees with transactionMgr', async () => {
      const { instance, getFeeRatesSpy } = createMockTxnMgr();

      const service = new TransactionService(
        instance,
        new TransactionStateManager(),
      );
      await service.estimateFees();

      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
    });

    it('throws TransactionServiceError if estimateFees failed', async () => {
      const { instance, getFeeRatesSpy } = createMockTxnMgr();
      getFeeRatesSpy.mockRejectedValue(new Error('error'));

      const service = new TransactionService(
        instance,
        new TransactionStateManager(),
      );

      await expect(service.estimateFees()).rejects.toThrow(
        TransactionServiceError,
      );
    });
  });
});
