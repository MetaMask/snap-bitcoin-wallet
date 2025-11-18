import type { Txid, Psbt, Amount, LocalOutput } from '@metamask/bitcoindevkit';
import type { KeyringRequest, KeyringAccount } from '@metamask/keyring-api';
import { BtcMethod, BtcScope } from '@metamask/keyring-api';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { AccountUseCases } from '../use-cases';
import {
  BroadcastPsbtRequest,
  ComputeFeeRequest,
  FillPsbtRequest,
  GetUtxoRequest,
  KeyringRequestHandler,
  SendTransferRequest,
  SignPsbtRequest,
} from './KeyringRequestHandler';
import type { BitcoinAccount } from '../entities';
import { AccountCapability } from '../entities';
import type { Utxo } from './mappings';
import { mapToUtxo } from './mappings';
import { parsePsbt } from './parsers';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

const mockPsbt = mock<Psbt>();
jest.mock('./parsers', () => ({
  parsePsbt: jest.fn(),
}));
jest.mock('./mappings', () => ({
  mapToUtxo: jest.fn(),
}));

describe('KeyringRequestHandler', () => {
  const mockAccountsUseCases = mock<AccountUseCases>();
  const origin = 'metamask';

  const handler = new KeyringRequestHandler(mockAccountsUseCases);

  beforeEach(() => {
    jest.mocked(parsePsbt).mockReturnValue(mockPsbt);
  });

  describe('route', () => {
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {},
      id: 'account-id',
      scope: 'scope',
      account: 'account-id',
    });

    it('throws error if unrecognized method', async () => {
      await expect(
        handler.route({ ...mockRequest, request: { method: 'randomMethod' } }),
      ).rejects.toThrow('Unrecognized Bitcoin account capability');
    });
  });

  describe('signPsbt', () => {
    const mockOptions = { fill: false, broadcast: true };
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {
        method: AccountCapability.SignPsbt,
        params: {
          psbt: 'psbtBase64',
          feeRate: 3,
          options: mockOptions,
        },
      },
      account: 'account-id',
    });

    it('executes signPsbt', async () => {
      mockAccountsUseCases.signPsbt.mockResolvedValue({
        psbt: 'psbtBase64',
        txid: mock<Txid>({
          toString: jest.fn().mockReturnValue('txid'),
        }),
      });

      const result = await handler.route(mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.request.params,
        SignPsbtRequest,
      );
      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        'metamask',
        mockOptions,
        3,
      );
      expect(result).toStrictEqual({
        pending: false,
        result: { psbt: 'psbtBase64', txid: 'txid' },
      });
    });

    it('propagates errors from parsePsbt', async () => {
      const error = new Error('parsePsbt');
      jest.mocked(parsePsbt).mockImplementationOnce(() => {
        throw error;
      });

      await expect(
        handler.route({
          ...mockRequest,
          request: { ...mockRequest.request, params: { psbt: 'invalidPsbt' } },
        }),
      ).rejects.toThrow(error);

      expect(mockAccountsUseCases.signPsbt).not.toHaveBeenCalled();
    });

    it('propagates errors from signPsbt', async () => {
      const error = new Error();
      mockAccountsUseCases.signPsbt.mockRejectedValue(error);

      await expect(handler.route(mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalled();
    });
  });

  describe('computeFee', () => {
    const mockRequest = mock<KeyringRequest>({
      request: {
        method: AccountCapability.ComputeFee,
        params: {
          psbt: 'psbtBase64',
          feeRate: 3,
        },
      },
      account: 'account-id',
    });

    it('executes computeFee', async () => {
      mockAccountsUseCases.computeFee.mockResolvedValue(
        mock<Amount>({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          to_sat: () => BigInt(1000),
        }),
      );

      const result = await handler.route(mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.request.params,
        ComputeFeeRequest,
      );
      expect(mockAccountsUseCases.computeFee).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        3,
      );
      expect(result).toStrictEqual({
        pending: false,
        result: { fee: '1000' },
      });
    });

    it('propagates errors from parsePsbt', async () => {
      const error = new Error('parsePsbt');
      jest.mocked(parsePsbt).mockImplementationOnce(() => {
        throw error;
      });

      await expect(
        handler.route({
          ...mockRequest,
          request: { ...mockRequest.request, params: { psbt: 'invalidPsbt' } },
        }),
      ).rejects.toThrow(error);

      expect(mockAccountsUseCases.computeFee).not.toHaveBeenCalled();
    });

    it('propagates errors from computeFee', async () => {
      const error = new Error();
      mockAccountsUseCases.computeFee.mockRejectedValue(error);

      await expect(handler.route(mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.computeFee).toHaveBeenCalled();
    });
  });

  describe('fillPsbt', () => {
    const mockRequest = mock<KeyringRequest>({
      request: {
        method: AccountCapability.FillPsbt,
        params: {
          psbt: 'psbtBase64',
          feeRate: 3,
        },
      },
      account: 'account-id',
    });

    it('executes fillPsbt', async () => {
      const mockFilledPsbt = mock<Psbt>({
        toString: jest.fn().mockReturnValue('filledPsbtBase64'),
      });
      mockAccountsUseCases.fillPsbt.mockResolvedValue(mockFilledPsbt);

      const result = await handler.route(mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.request.params,
        FillPsbtRequest,
      );
      expect(mockAccountsUseCases.fillPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        3,
      );
      expect(result).toStrictEqual({
        pending: false,
        result: { psbt: 'filledPsbtBase64' },
      });
    });

    it('propagates errors from parsePsbt', async () => {
      const error = new Error('parsePsbt');
      jest.mocked(parsePsbt).mockImplementationOnce(() => {
        throw error;
      });

      await expect(
        handler.route({
          ...mockRequest,
          request: { ...mockRequest.request, params: { psbt: 'invalidPsbt' } },
        }),
      ).rejects.toThrow(error);

      expect(mockAccountsUseCases.fillPsbt).not.toHaveBeenCalled();
    });

    it('propagates errors from fillPsbt', async () => {
      const error = new Error();
      mockAccountsUseCases.fillPsbt.mockRejectedValue(error);

      await expect(handler.route(mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.fillPsbt).toHaveBeenCalled();
    });
  });

  describe('broadcastPsbt', () => {
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {
        method: AccountCapability.BroadcastPsbt,
        params: {
          psbt: 'psbtBase64',
          feeRate: 3,
        },
      },
      account: 'account-id',
    });

    it('executes broadcastPsbt', async () => {
      const mockTxid = mock<Txid>({
        toString: jest.fn().mockReturnValue('txid'),
      });
      mockAccountsUseCases.broadcastPsbt.mockResolvedValue(mockTxid);

      const result = await handler.route(mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.request.params,
        BroadcastPsbtRequest,
      );
      expect(mockAccountsUseCases.broadcastPsbt).toHaveBeenCalledWith(
        'account-id',
        mockPsbt,
        origin,
      );
      expect(result).toStrictEqual({
        pending: false,
        result: { txid: 'txid' },
      });
    });

    it('propagates errors from parsePsbt', async () => {
      const error = new Error('parsePsbt');
      jest.mocked(parsePsbt).mockImplementationOnce(() => {
        throw error;
      });

      await expect(
        handler.route({
          ...mockRequest,
          request: { ...mockRequest.request, params: { psbt: 'invalidPsbt' } },
        }),
      ).rejects.toThrow(error);

      expect(mockAccountsUseCases.broadcastPsbt).not.toHaveBeenCalled();
    });

    it('propagates errors from fillPsbt', async () => {
      const error = new Error();
      mockAccountsUseCases.broadcastPsbt.mockRejectedValue(error);

      await expect(handler.route(mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.broadcastPsbt).toHaveBeenCalled();
    });
  });

  describe('sendTransfer', () => {
    const recipients = [
      {
        address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz',
        amount: '1000',
      },
    ];
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {
        method: AccountCapability.SendTransfer,
        params: {
          recipients,
          feeRate: 3,
        },
      },
      account: 'account-id',
    });

    it('executes sendTransferq', async () => {
      const mockTxid = mock<Txid>({
        toString: jest.fn().mockReturnValue('txid'),
      });
      mockAccountsUseCases.sendTransfer.mockResolvedValue(mockTxid);

      const result = await handler.route(mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.request.params,
        SendTransferRequest,
      );
      expect(mockAccountsUseCases.sendTransfer).toHaveBeenCalledWith(
        'account-id',
        recipients,
        origin,
        3,
      );
      expect(result).toStrictEqual({
        pending: false,
        result: { txid: 'txid' },
      });
    });

    it('propagates errors from sendTransfer', async () => {
      const error = new Error();
      mockAccountsUseCases.sendTransfer.mockRejectedValue(error);

      await expect(handler.route(mockRequest)).rejects.toThrow(error);

      expect(mockAccountsUseCases.sendTransfer).toHaveBeenCalled();
    });
  });

  describe('getUtxo', () => {
    const mockLocalOutput = mock<LocalOutput>();
    const mockAccount = mock<BitcoinAccount>({
      getUtxo: () => mockLocalOutput,
      network: 'bitcoin',
    });
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {
        method: AccountCapability.GetUtxo,
        params: {
          outpoint: 'mytxid:0',
        },
      },
      account: 'account-id',
    });

    it('executes getUtxo', async () => {
      const expectedUtxo = {
        derivationIndex: 0,
        outpoint: 'mytxid:0',
        value: '1000',
        scriptPubkey: 'scriptPubkey',
        scriptPubkeyHex: 'scriptPubkeyHex',
      };
      mockAccountsUseCases.get.mockResolvedValue(mockAccount);
      jest.mocked(mapToUtxo).mockReturnValue(expectedUtxo);
      const result = await handler.route(mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.request.params,
        GetUtxoRequest,
      );
      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
      expect(result).toStrictEqual({
        pending: false,
        result: expectedUtxo,
      });
    });
  });

  describe('listUtxos', () => {
    const mockLocalOutput = mock<LocalOutput>();
    const mockAccount = mock<BitcoinAccount>({
      listUnspent: () => [mockLocalOutput, mockLocalOutput],
      network: 'bitcoin',
    });
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {
        method: AccountCapability.ListUtxos,
      },
      account: 'account-id',
    });

    it('executes listUtxos', async () => {
      const mockUtxo = mock<Utxo>({
        derivationIndex: 0,
        outpoint: 'mytxid:0',
        value: '1000',
        scriptPubkey: 'scriptPubkey',
        scriptPubkeyHex: 'scriptPubkeyHex',
      });
      mockAccountsUseCases.get.mockResolvedValue(mockAccount);
      jest.mocked(mapToUtxo).mockReturnValue(mockUtxo);
      const result = await handler.route(mockRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
      expect(result).toStrictEqual({
        pending: false,
        result: [mockUtxo, mockUtxo],
      });
    });
  });

  describe('publicDescriptor', () => {
    const mockAccount = mock<BitcoinAccount>({
      publicDescriptor: 'publicDescriptor',
    });
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {
        method: AccountCapability.PublicDescriptor,
      },
      account: 'account-id',
    });

    it('executes publicDescriptor', async () => {
      mockAccountsUseCases.get.mockResolvedValue(mockAccount);
      const result = await handler.route(mockRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
      expect(result).toStrictEqual({
        pending: false,
        result: 'publicDescriptor',
      });
    });
  });

  describe('signMessage', () => {
    const mockRequest = mock<KeyringRequest>({
      origin,
      request: {
        method: AccountCapability.SignMessage,
        params: {
          message: 'message',
        },
      },
      account: 'account-id',
    });

    it('executes signMessage', async () => {
      mockAccountsUseCases.signMessage.mockResolvedValue('signature');
      const result = await handler.route(mockRequest);

      expect(mockAccountsUseCases.signMessage).toHaveBeenCalledWith(
        'account-id',
        'message',
        'metamask',
      );
      expect(result).toStrictEqual({
        pending: false,
        result: { signature: 'signature' },
      });
    });
  });

  describe('resolveAccountAddress', () => {
    const mockAccount1 = mock<KeyringAccount>({
      id: 'account-1',
      address: 'test123',
      scopes: [BtcScope.Regtest],
    });
    const mockAccount2 = mock<KeyringAccount>({
      id: 'account-2',
      address: 'test456',
      scopes: [BtcScope.Regtest, BtcScope.Testnet],
    });
    const mockAccount3 = mock<KeyringAccount>({
      id: 'account-3',
      address: 'test789',
      scopes: [BtcScope.Testnet],
    });

    it('resolves account address for SignPsbt', () => {
      const request = {
        method: BtcMethod.SignPsbt as const,
        params: {
          account: { address: 'test123' },
          psbt: 'psbt',
          options: { fill: false, broadcast: false },
        },
      };

      const result = handler.resolveAccountAddress(
        [mockAccount1, mockAccount2, mockAccount3],
        BtcScope.Regtest,
        request,
      );

      expect(result).toBe('bip122:regtest:test123');
    });

    it('resolves account address for SendTransfer', () => {
      const request = {
        method: BtcMethod.SendTransfer as const,
        params: {
          account: { address: 'test456' },
          recipients: [{ address: 'recipient', amount: '1000' }],
        },
      };

      const result = handler.resolveAccountAddress(
        [mockAccount1, mockAccount2, mockAccount3],
        BtcScope.Regtest,
        request,
      );

      expect(result).toBe('bip122:regtest:test456');
    });

    it('resolves account address for SignMessage', () => {
      const request = {
        method: BtcMethod.SignMessage as const,
        params: {
          account: { address: 'test123' },
          message: 'hello',
        },
      };

      const result = handler.resolveAccountAddress(
        [mockAccount1, mockAccount2, mockAccount3],
        BtcScope.Regtest,
        request,
      );

      expect(result).toBe('bip122:regtest:test123');
    });

    it('throws error if no accounts with scope', () => {
      const request = {
        method: BtcMethod.SignPsbt as const,
        params: {
          account: { address: 'test123' },
          psbt: 'psbt',
          options: { fill: false, broadcast: false },
        },
      };

      expect(() =>
        handler.resolveAccountAddress(
          [mockAccount3],
          BtcScope.Regtest,
          request,
        ),
      ).toThrow('No accounts with this scope');
    });

    it('throws error if account address not found', () => {
      const request = {
        method: BtcMethod.SignPsbt as const,
        params: {
          account: { address: 'notfound' },
          psbt: 'psbt',
          options: { fill: false, broadcast: false },
        },
      };

      expect(() =>
        handler.resolveAccountAddress(
          [mockAccount1, mockAccount2, mockAccount3],
          BtcScope.Regtest,
          request,
        ),
      ).toThrow('Account not found');
    });

    it('throws error for unsupported method', () => {
      const request = {
        method: 'unsupported' as BtcMethod,
        params: {},
      };

      expect(() =>
        handler.resolveAccountAddress(
          [mockAccount1, mockAccount2, mockAccount3],
          BtcScope.Regtest,
          request as any,
        ),
      ).toThrow('Unsupported method');
    });
  });
});
