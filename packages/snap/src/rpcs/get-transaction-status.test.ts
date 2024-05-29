import { InvalidParamsError } from '@metamask/snaps-sdk';

import { TransactionStatus } from '../chain';
import { Factory } from '../factory';
import { Network } from '../modules/bitcoin/constants';
import { GetTransactionStatusHandler } from './get-transaction-status';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GetBalancesHandler', () => {
  const txnHash =
    '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const getTransactionStatusSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        estimateFees: jest.fn(),
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
        confirmations: 6,
      };

      getTransactionStatusSpy.mockResolvedValue(mockResp);

      const result = await GetTransactionStatusHandler.getInstance().execute({
        scope: Network.Testnet,
        transactionId: txnHash,
      });

      expect(getTransactionStatusSpy).toHaveBeenCalledWith(txnHash);
      expect(result).toStrictEqual({
        status: TransactionStatus.Confirmed,
        details: {
          confirmations: 6,
        },
      });
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
