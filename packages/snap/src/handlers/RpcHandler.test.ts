import type { Psbt, Txid } from '@metamask/bitcoindevkit';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { SendFlowUseCases } from '../use-cases';
import {
  CreateSendFormRequest,
  RpcHandler,
  RpcMethod,
  SendPsbtRequest,
} from './RpcHandler';
import type { AccountUseCases } from '../use-cases/AccountUseCases';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

const mockPsbt = mock<Psbt>();
// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Psbt: { from_string: () => mockPsbt },
}));

describe('RpcHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountsUseCases = mock<AccountUseCases>();
  const origin = 'metamask';

  const handler = new RpcHandler(mockSendFlowUseCases, mockAccountsUseCases);

  describe('route', () => {
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.StartSendTransactionFlow,
      params: {
        account: 'account-id',
      },
    });

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
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.StartSendTransactionFlow,
      params: {
        account: 'account-id',
      },
    });

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
      expect(result).toStrictEqual({ txid: 'txId' });
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

  describe('fillAndSendPsbt', () => {
    const psbt =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=';
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.FillAndSendPsbt,
      params: {
        account: 'account-id',
        psbt,
      },
    });

    it('executes fillAndSendPsbt', async () => {
      mockAccountsUseCases.fillAndSendPsbt.mockResolvedValue(
        mock<Txid>({
          toString: jest.fn().mockReturnValue('txId'),
        }),
      );

      const result = await handler.route(origin, mockRequest);

      expect(assert).toHaveBeenCalledWith(mockRequest.params, SendPsbtRequest);
      expect(mockAccountsUseCases.fillAndSendPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        'metamask',
      );
      expect(result).toStrictEqual({ txid: 'txId' });
    });

    it('propagates errors from fillAndSendPsbt', async () => {
      const error = new Error();
      mockAccountsUseCases.fillAndSendPsbt.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.fillAndSendPsbt).toHaveBeenCalled();
    });
  });
});
