import { InvalidParamsError } from '@metamask/snaps-sdk';

import { Network } from '../bitcoin/constants';
import { TransactionStatus } from '../chain';
import { Factory } from '../factory';
import { GetTransactionStatusHandler } from './get-transaction-status';

jest.mock('../libs/logger/logger');

describe('GetBalancesHandler', () => {
  const txnHash =
    '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const getTransactionStatusSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        getFeeRates: jest.fn(),
        getBalances: jest.fn(),
        broadcastTransaction: jest.fn(),
        listTransactions: jest.fn(),
        getTransactionStatus: getTransactionStatusSpy,
        getDataForTransaction: jest.fn(),
      });
      return {
        getTransactionStatusSpy,
      };
    };

    it('gets status', async () => {
      const { getTransactionStatusSpy } = createMockChainApiFactory();

      const mockResp = {
        status: TransactionStatus.Confirmed,
      };

      getTransactionStatusSpy.mockResolvedValue(mockResp);

      const result = await GetTransactionStatusHandler.getInstance().execute({
        scope: Network.Testnet,
        transactionId: txnHash,
      });

      expect(getTransactionStatusSpy).toHaveBeenCalledWith(txnHash);
      expect(result).toStrictEqual({
        status: TransactionStatus.Confirmed,
      });
    });

    it('throws `Fail to get the transaction status` when transaction status fetch failed', async () => {
      const { getTransactionStatusSpy } = createMockChainApiFactory();

      getTransactionStatusSpy.mockRejectedValue(new Error('error'));

      await expect(
        GetTransactionStatusHandler.getInstance().execute({
          scope: Network.Testnet,
          transactionId: txnHash,
        }),
      ).rejects.toThrow(`Fail to get the transaction status`);
    });

    it('throws `Request params is invalid` when request parameter is not correct', async () => {
      await expect(
        GetTransactionStatusHandler.getInstance().execute({
          scope: Network.Testnet,
        }),
      ).rejects.toThrow(InvalidParamsError);
    });
  });
});
