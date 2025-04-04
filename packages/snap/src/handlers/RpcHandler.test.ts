import type { Txid } from '@metamask/bitcoindevkit';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { TransactionRequest } from '../entities';
import type { SendFlowUseCases } from '../use-cases';
import type { AccountUseCases } from '../use-cases/AccountUseCases';
import { InternalRpcMethod } from './permissions';
import { CreateSendFormRequest, RpcHandler } from './RpcHandler';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

describe('RpcHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountsUseCases = mock<AccountUseCases>();
  const mockTxRequest = mock<TransactionRequest>();
  const origin = 'metamask';

  const handler = new RpcHandler(mockSendFlowUseCases, mockAccountsUseCases);

  describe('route', () => {
    it('throws error if missing params', async () => {
      const request = mock<JsonRpcRequest>();

      await expect(handler.route({ origin, request })).rejects.toThrow(
        'Missing params',
      );
    });

    it('throws error if unrecognized method', async () => {
      const request = mock<JsonRpcRequest>({ method: 'randomMethod' });

      await expect(handler.route({ origin, request })).rejects.toThrow(
        'Method not found: randomMethod',
      );
    });
  });

  describe('executeSendFlow', () => {
    const mockRequest = mock<JsonRpcRequest>({
      method: InternalRpcMethod.StartSendTransactionFlow,
      params: {
        account: 'account-id',
      },
    });

    it('executes startSendTransactionFlow', async () => {
      mockSendFlowUseCases.display.mockResolvedValue(mockTxRequest);
      mockAccountsUseCases.send.mockResolvedValue(
        mock<Txid>({
          toString: jest.fn().mockReturnValue('txId'),
        }),
      );

      const result = await handler.route({ origin, request: mockRequest });

      expect(assert).toHaveBeenCalledWith(
        mockRequest.params,
        CreateSendFormRequest,
      );
      expect(mockSendFlowUseCases.display).toHaveBeenCalledWith('account-id');
      expect(mockAccountsUseCases.send).toHaveBeenCalledWith(
        'account-id',
        mockTxRequest,
      );
      expect(result).toStrictEqual({ txId: 'txId' });
    });

    it('propagates errors from display', async () => {
      const error = new Error();
      mockSendFlowUseCases.display.mockRejectedValue(error);

      await expect(
        handler.route({ origin, request: mockRequest }),
      ).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.send).not.toHaveBeenCalled();
    });

    it('propagates errors from send', async () => {
      const error = new Error();
      mockSendFlowUseCases.display.mockResolvedValue(mockTxRequest);
      mockAccountsUseCases.send.mockRejectedValue(error);

      await expect(
        handler.route({ origin, request: mockRequest }),
      ).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.send).toHaveBeenCalled();
    });
  });
});
