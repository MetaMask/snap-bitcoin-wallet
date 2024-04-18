import { networks } from 'bitcoinjs-lib';

import { generateAccounts } from '../../../../test/utils';
import type { IReadDataClient } from '../data-client';
import { BtcTransactionMgr } from './manager';

describe('BtcTransactionMgr', () => {
  const createMockReadDataClient = () => {
    const getBalanceSpy = jest.fn();

    class MockReadDataClient implements IReadDataClient {
      getBalance = getBalanceSpy;
    }
    return {
      instance: new MockReadDataClient(),
      getBalanceSpy,
    };
  };

  const createMockBtcTransactionMgr = (readDataClient: IReadDataClient) => {
    const instance = new BtcTransactionMgr(readDataClient, {
      network: networks.bitcoin,
    });

    return {
      instance,
    };
  };

  describe('getBalance', () => {
    it('calls getBalance with readClient', async () => {
      const { instance, getBalanceSpy } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcTransactionMgr(instance);
      const account = generateAccounts(1)[0];

      await txnMgr.getBalance(account.address);

      expect(getBalanceSpy).toHaveBeenCalledWith(account.address);
    });

    it('throws TransactionMgrError if the getBalance failed', async () => {
      const { instance, getBalanceSpy } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcTransactionMgr(instance);
      getBalanceSpy.mockRejectedValue(new Error('error'));
      const account = generateAccounts(1)[0];

      await expect(txnMgr.getBalance(account.address)).rejects.toThrow('error');
    });
  });
});
