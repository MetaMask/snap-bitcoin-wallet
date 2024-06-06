import { InvalidParamsError } from '@metamask/snaps-sdk';

import { Network } from '../bitcoin/constants';
import { TransactionStatus } from '../chain';
import { Factory } from '../factory';
import { getTransactionStatus } from './get-transaction-status';

jest.mock('../logger');

describe('getTransactionStatus', () => {
  const txHash =
    '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

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

    const result = await getTransactionStatus({
      scope: Network.Testnet,
      transactionId: txHash,
    });

    expect(getTransactionStatusSpy).toHaveBeenCalledWith(txHash);
    expect(result).toStrictEqual({
      status: TransactionStatus.Confirmed,
    });
  });

  it('throws `Fail to get the transaction status` when transaction status fetch failed', async () => {
    const { getTransactionStatusSpy } = createMockChainApiFactory();

    getTransactionStatusSpy.mockRejectedValue(new Error('error'));

    await expect(
      getTransactionStatus({
        scope: Network.Testnet,
        transactionId: txHash,
      }),
    ).rejects.toThrow(`Fail to get the transaction status`);
  });

  it('throws `Request params is invalid` when request parameter is not correct', async () => {
    await expect(
      getTransactionStatus({
        scope: 'some-scope',
        transactionId: '',
      }),
    ).rejects.toThrow(InvalidParamsError);
  });
});
