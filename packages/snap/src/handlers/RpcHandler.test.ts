import type { Psbt, Txid } from '@metamask/bitcoindevkit';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { SendFlowUseCases } from '../use-cases';
import { CreateSendFormRequest, RpcHandler, RpcMethod } from './RpcHandler';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

describe('RpcHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountsUseCases = mock<AccountUseCases>();
  const mockPsbt = mock<Psbt>();
  const origin = 'metamask';
  const mockRequest = mock<JsonRpcRequest>({
    method: RpcMethod.StartSendTransactionFlow,
    params: {
      account: 'account-id',
    },
  });

  const handler = new RpcHandler(mockSendFlowUseCases, mockAccountsUseCases);

  describe('route', () => {
    it('throws error if invalid origin', async () => {
      await expect(handler.route('invalidOrigin', mockRequest)).rejects.toThrow(
        'Invalid origin',
      );
    });

    it('throws error if missing params', async () => {
      await expect(
        handler.route(origin, { ...mockRequest, params: undefined }),
      ).rejects.toThrow('Missing params');
    });

    it('throws error if unrecognized method', async () => {
      await expect(
        handler.route(origin, { ...mockRequest, method: 'randomMethod' }),
      ).rejects.toThrow('Method not found: randomMethod');
    });
  });

  describe('executeSendFlow', () => {
    it('executes startSendTransactionFlow', async () => {
      mockSendFlowUseCases.display.mockResolvedValue(mockPsbt);
      mockAccountsUseCases.sendPsbt.mockResolvedValue(
        mock<Txid>({
          toString: jest.fn().mockReturnValue('txId'),
        }),
      );

      const result = await handler.route(origin, mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.params,
        CreateSendFormRequest,
      );
      expect(mockSendFlowUseCases.display).toHaveBeenCalledWith('account-id');
      expect(mockAccountsUseCases.sendPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        'metamask',
      );
      expect(result).toStrictEqual({ txId: 'txId' });
    });

    it('propagates errors from display', async () => {
      const error = new Error();
      mockSendFlowUseCases.display.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.sendPsbt).not.toHaveBeenCalled();
    });

    it('propagates errors from send', async () => {
      const error = new Error();
      mockSendFlowUseCases.display.mockResolvedValue(mockPsbt);
      mockAccountsUseCases.sendPsbt.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.sendPsbt).toHaveBeenCalled();
    });
  });
});
