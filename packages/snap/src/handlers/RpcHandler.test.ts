import { Psbt } from '@metamask/bitcoindevkit';
import type { Amount, Txid } from '@metamask/bitcoindevkit';
import { BtcScope, FeeType } from '@metamask/keyring-api';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { Caip19Asset } from './caip';
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
      mockAccountsUseCases.signPsbt.mockResolvedValue({
        psbt: 'psbtBase64',
        txid: mock<Txid>({
          toString: jest.fn().mockReturnValue('txId'),
        }),
      });

      const result = await handler.route(origin, mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.params,
        CreateSendFormRequest,
      );
      expect(mockSendFlowUseCases.display).toHaveBeenCalledWith('account-id');
      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        'metamask',
        { broadcast: true, fill: false },
      );
      expect(result).toStrictEqual({ transactionId: 'txId' });
    });

    it('propagates errors from display', async () => {
      const error = new Error();
      mockSendFlowUseCases.display.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.signPsbt).not.toHaveBeenCalled();
    });

    it('propagates errors from send', async () => {
      const error = new Error();
      mockSendFlowUseCases.display.mockResolvedValue(mockPsbt);
      mockAccountsUseCases.signPsbt.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalled();
    });
  });

  describe('signAndSendTransaction', () => {
    const psbt =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=';
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.SignAndSendTransaction,
      params: {
        accountId: 'account-id',
        transaction: psbt,
      },
    });

    it('executes signAndSendTransaction', async () => {
      mockAccountsUseCases.signPsbt.mockResolvedValue({
        psbt: 'psbtBase64',
        txid: mock<Txid>({
          toString: jest.fn().mockReturnValue('txId'),
        }),
      });

      const result = await handler.route(origin, mockRequest);

      expect(assert).toHaveBeenCalledWith(mockRequest.params, SendPsbtRequest);
      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        'metamask',
        { broadcast: true, fill: true },
      );
      expect(result).toStrictEqual({ transactionId: 'txId' });
    });

    it('propagates errors from signAndSendTransaction', async () => {
      const error = new Error();
      mockAccountsUseCases.signPsbt.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalled();
    });
  });

  describe('computeFee', () => {
    const psbt = 'someEncodedPsbt';
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.ComputeFee,
      params: {
        accountId: 'account-id',
        transaction: psbt,
        scope: BtcScope.Mainnet,
      },
    });

    it('executes computeFee', async () => {
      const mockAmount = mock<Amount>({
        to_btc: jest.fn().mockReturnValue('0.00001'),
      });
      mockAccountsUseCases.computeFee.mockResolvedValue(mockAmount);

      const result = await handler.route(origin, mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.params,
        ComputeFeeRequest,
      );
      expect(Psbt.from_string).toHaveBeenCalledWith(psbt);
      expect(mockAccountsUseCases.computeFee).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
      );
      expect(result).toStrictEqual([
        {
          type: FeeType.Priority,
          asset: {
            unit: 'BTC',
            type: Caip19Asset.Bitcoin,
            amount: '0.00001',
            fungible: true,
          },
        },
      ]);
    });

    it('propagates errors from computeFee', async () => {
      const error = new Error('Insufficient funds');
      mockAccountsUseCases.computeFee.mockRejectedValue(error);

      await expect(handler.route(origin, mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.computeFee).toHaveBeenCalled();
    });

    it('throws FormatError for invalid PSBT', async () => {
      const invalidRequest = mock<JsonRpcRequest>({
        method: RpcMethod.ComputeFee,
        params: {
          accountId: 'account-id',
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

      expect(mockAccountsUseCases.computeFee).not.toHaveBeenCalled();
    });
  });
});
