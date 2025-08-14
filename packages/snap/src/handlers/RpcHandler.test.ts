import { Psbt } from '@metamask/bitcoindevkit';
import type { Amount, Txid } from '@metamask/bitcoindevkit';
import { BtcScope } from '@metamask/keyring-api';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import {
  CreateSendFormRequest,
  ComputeFeeRequest,
  RpcHandler,
  RpcMethod,
  SendPsbtRequest,
} from './RpcHandler';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

const mockPsbt = mock<Psbt>();
// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Psbt: { from_string: jest.fn() },
}));

describe('RpcHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountsUseCases = mock<AccountUseCases>();
  const origin = 'metamask';

  const handler = new RpcHandler(mockSendFlowUseCases, mockAccountsUseCases);

  beforeEach(() => {
    jest.mocked(Psbt.from_string).mockReturnValue(mockPsbt);
  });

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

  describe('getFeeForTransaction', () => {
    const psbt = 'someEncodedPsbt';
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.ComputeFee,
      params: {
        account: 'account-id',
        transaction: psbt,
        scope: BtcScope.Mainnet,
      },
    });

    it('executes getFeeForTransaction', async () => {
      const mockAmount = mock<Amount>({
        to_btc: jest.fn().mockReturnValue('0.00001'),
      });
      mockAccountsUseCases.getFeeForPsbt.mockResolvedValue(mockAmount);

      const result = await handler.route(origin, mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.params,
        ComputeFeeRequest,
      );
      expect(Psbt.from_string).toHaveBeenCalledWith(psbt);
      expect(mockAccountsUseCases.getFeeForPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
      );
      expect(result).toStrictEqual({
        fee: [
          {
            type: 'base',
            asset: {
              unit: 'btc',
              type: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
              amount: '0.00001',
              fungible: true,
            },
          },
        ],
      });
    });

    it('propagates errors from getFeeForPsbt', async () => {
      const error = new Error('Insufficient funds');
      mockAccountsUseCases.getFeeForPsbt.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.getFeeForPsbt).toHaveBeenCalled();
    });

    it('throws FormatError for invalid PSBT', async () => {
      const invalidRequest = mock<JsonRpcRequest>({
        method: RpcMethod.ComputeFee,
        params: {
          account: 'account-id',
          transaction: 'invalid-psbt-base64',
          scope: BtcScope.Mainnet,
        },
      });

      jest.mocked(Psbt.from_string).mockImplementationOnce(() => {
        throw new Error('Invalid PSBT');
      });

      await expect(handler.route(origin, invalidRequest)).rejects.toThrow(
        'Invalid PSBT',
      );

      expect(mockAccountsUseCases.getFeeForPsbt).not.toHaveBeenCalled();
    });
  });
});
