import { InvalidParamsError } from '@metamask/snaps-sdk';

import { TransactionStatus } from '../bitcoin/chain';
import { Caip2ChainId } from '../constants';
import { createMockChainApiFactory } from './__tests__/helper';
import { getTransactionStatus } from './get-transaction-status';

jest.mock('../utils/logger');

describe('getTransactionStatus', () => {
  const txHash =
    '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

  it('gets status', async () => {
    const { getTransactionStatusSpy } = createMockChainApiFactory();

    const mockResp = {
      status: TransactionStatus.Confirmed,
    };

    getTransactionStatusSpy.mockResolvedValue(mockResp);

    const result = await getTransactionStatus({
      scope: Caip2ChainId.Testnet,
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
        scope: Caip2ChainId.Testnet,
        transactionId: txHash,
      }),
    ).rejects.toThrow(`Fail to get the transaction status`);
  });

  it('throws `Request params is invalid` when request parameter is not correct', async () => {
    await expect(
      getTransactionStatus({
        scope: Caip2ChainId.Testnet,
        transactionId: '',
      }),
    ).rejects.toThrow(InvalidParamsError);

    await expect(
      getTransactionStatus({
        scope: Caip2ChainId.Testnet,
        transactionId: 'x',
      }),
    ).rejects.toThrow(InvalidParamsError);

    await expect(
      getTransactionStatus({
        scope: Caip2ChainId.Testnet,
        transactionId:
          // 63 characters long while `transactionId` is expected to be 64 long
          '2c2a9ef9cecbe08117da640ce5761c8d2209b418cd43cc3af05ffc16a425828',
      }),
    ).rejects.toThrow(InvalidParamsError);
  });
});
