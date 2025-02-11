import { mock } from 'jest-mock-extended';

import type { TransactionRequest } from '../entities';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { CreateSendFormRequest, RpcHandler } from './RpcHandler';
import { SendFormUseCases } from '../use-cases';
import { InternalRpcMethod } from '../permissions';
import { assert } from 'superstruct';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

describe('RpcHandler', () => {
  const mockSendFormUseCases = mock<SendFormUseCases>();
  const mockAccountsUseCases = mock<AccountUseCases>();
  const mockTxRequest = mock<TransactionRequest>();

  let handler: RpcHandler;

  beforeEach(() => {
    handler = new RpcHandler(mockSendFormUseCases, mockAccountsUseCases);
  });

  describe('route', () => {
    it('throws error if missing params', async () => {
      await expect(handler.route('method')).rejects.toThrow('Missing params');
    });

    it('throws error if unrecognized method', async () => {
      await expect(handler.route('randomMethod', {})).rejects.toThrow(
        'Method not found: randomMethod',
      );
    });
  });

  describe('executeSendFlow', () => {
    const params = {
      account: 'account-id',
    };

    it('executes startSendTransactionFlow', async () => {
      mockSendFormUseCases.display.mockResolvedValue(mockTxRequest);
      mockAccountsUseCases.send.mockResolvedValue('txId');

      const result = await handler.route(
        InternalRpcMethod.StartSendTransactionFlow,
        params,
      );

      expect(assert).toHaveBeenCalledWith(params, CreateSendFormRequest);
      expect(mockSendFormUseCases.display).toHaveBeenCalledWith('account-id');
      expect(mockAccountsUseCases.send).toHaveBeenCalledWith(
        'account-id',
        mockTxRequest,
      );
      expect(result).toEqual({ txId: 'txId' });
    });

    it('propagates errors from display', async () => {
      const error = new Error();
      mockSendFormUseCases.display.mockRejectedValue(error);

      await expect(
        handler.route(InternalRpcMethod.StartSendTransactionFlow, params),
      ).rejects.toThrow(error);

      expect(mockSendFormUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.send).not.toHaveBeenCalled();
    });

    it('propagates errors from send', async () => {
      const error = new Error();
      mockSendFormUseCases.display.mockResolvedValue(mockTxRequest);
      mockAccountsUseCases.send.mockRejectedValue(error);

      await expect(
        handler.route(InternalRpcMethod.StartSendTransactionFlow, params),
      ).rejects.toThrow(error);

      expect(mockSendFormUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.send).toHaveBeenCalled();
    });
  });
});
