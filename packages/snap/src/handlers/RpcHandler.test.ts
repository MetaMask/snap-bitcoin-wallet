import { Psbt, Address } from '@metamask/bitcoindevkit';
import type { Amount, Txid, Transaction } from '@metamask/bitcoindevkit';
import type { Transaction as KeyringTransaction } from '@metamask/keyring-api';
import { BtcScope, FeeType, TransactionStatus } from '@metamask/keyring-api';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { Caip19Asset } from './caip';
import {
  ComputeFeeRequest,
  CreateSendFormRequest,
  RpcHandler,
  SendPsbtRequest,
  VerifyMessageRequest,
} from './RpcHandler';
import { RpcMethod, SendErrorCodes } from './validation';
import type { Logger, BitcoinAccount, TransactionBuilder } from '../entities';
import { mapPsbtToTransaction } from './mappings';

jest.mock('superstruct', () => ({
  ...jest.requireActual('superstruct'),
  assert: jest.fn(),
}));

const mockPsbt = mock<Psbt>();
// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Psbt: { from_string: jest.fn() },
  Address: {
    from_string: jest.fn(),
  },
}));

jest.mock('./mappings', () => ({
  ...jest.requireActual('./mappings'),
  mapPsbtToTransaction: jest.fn(),
}));

describe('RpcHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountsUseCases = mock<AccountUseCases>();
  const mockLogger = mock<Logger>();
  const origin = 'metamask';
  const validAccountId = '724ac464-6572-4d9c-a8e2-4075c8846d65';

  const handler = new RpcHandler(
    mockSendFlowUseCases,
    mockAccountsUseCases,
    mockLogger,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(Psbt.from_string).mockReturnValue(mockPsbt);

    // setup Address mock with validation logic
    const validAddresses = [
      'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8', // bech32 mainnet
      'bc1qtest123address', // test address
      '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // P2PKH mainnet
      '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', // P2SH mainnet
    ];

    jest
      .mocked(Address.from_string)
      .mockImplementation((address: string, _: string) => {
        if (validAddresses.includes(address)) {
          return { toString: () => address } as any;
        }
        throw new Error(`Invalid address: ${address}`);
      });
  });

  describe('parameter validation', () => {
    beforeEach(() => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);
    });

    describe('onAddressInput validation', () => {
      it('rejects invalid address format', async () => {
        const invalidAddressRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAddressInput,
          params: {
            value: 'not-a-valid-address',
            accountId: validAccountId,
          },
        });

        const result = await handler.route(origin, invalidAddressRequest);

        expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Invalid account and/or invalid address. Error: %s',
          expect.any(String),
        );
        expect(result).toStrictEqual({
          valid: false,
          errors: [{ code: SendErrorCodes.Invalid }],
        });
      });

      it('rejects invalid UUID accountId', async () => {
        const invalidRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAddressInput,
          params: {
            value: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
            accountId: 'not-a-uuid',
          },
        });

        await expect(handler.route(origin, invalidRequest)).rejects.toThrow(
          'Expected a string matching',
        );
      });

      it('rejects missing value parameter', async () => {
        const missingValueRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAddressInput,
          params: {
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            // Missing 'value' field
          },
        });

        await expect(
          handler.route(origin, missingValueRequest),
        ).rejects.toThrow('At path: value -- Expected a string');
      });

      it('rejects missing accountId parameter', async () => {
        const missingAccountRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAddressInput,
          params: {
            value: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
            // Missing 'accountId' field
          },
        });

        await expect(
          handler.route(origin, missingAccountRequest),
        ).rejects.toThrow('At path: accountId -- Expected a string');
      });
    });

    describe('onAmountInput validation', () => {
      it('rejects invalid UUID accountId', async () => {
        const invalidRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAmountInput,
          params: {
            value: '1.5',
            accountId: 'not-a-uuid',
            assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
          },
        });

        await expect(handler.route(origin, invalidRequest)).rejects.toThrow(
          'Expected a string matching',
        );
      });

      it('rejects negative amounts', async () => {
        const negativeAmountRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAmountInput,
          params: {
            value: '-0.5',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
          },
        });

        const result = await handler.route(origin, negativeAmountRequest);

        expect(result).toStrictEqual({
          valid: false,
          errors: [{ code: SendErrorCodes.Invalid }],
        });
      });

      it('rejects zero amount', async () => {
        const zeroAmountRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAmountInput,
          params: {
            value: '0',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
          },
        });

        const result = await handler.route(origin, zeroAmountRequest);

        expect(result).toStrictEqual({
          valid: false,
          errors: [{ code: SendErrorCodes.Invalid }],
        });
      });

      it('rejects invalid number formats', async () => {
        const testCases = ['abc', '1.2.3', 'not-a-number', 'NaN', 'Infinity'];

        for (const invalidValue of testCases) {
          const invalidAmountRequest = mock<JsonRpcRequest>({
            method: RpcMethod.OnAmountInput,
            params: {
              value: invalidValue,
              accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
              assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
            },
          });

          const result = await handler.route(origin, invalidAmountRequest);

          expect(result).toStrictEqual({
            valid: false,
            errors: [{ code: SendErrorCodes.Invalid }],
          });
        }
      });

      it('rejects missing assetId parameter', async () => {
        const missingAssetRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAmountInput,
          params: {
            value: '1.5',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            // Missing 'assetId' field
          },
        });

        await expect(
          handler.route(origin, missingAssetRequest),
        ).rejects.toThrow(
          'At path: assetId -- Expected a value of type `CaipAssetType`',
        );
      });

      it('rejects invalid assetId format', async () => {
        const invalidAssetRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAmountInput,
          params: {
            value: '1.5',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            assetId: 'invalid-asset-id',
          },
        });

        await expect(
          handler.route(origin, invalidAssetRequest),
        ).rejects.toThrow(
          'At path: assetId -- Expected a value of type `CaipAssetType`',
        );
      });
    });

    describe('verifyMessage validation', () => {
      it('rejects missing parameters', async () => {
        const missingParamsRequest = mock<JsonRpcRequest>({
          method: RpcMethod.VerifyMessage,
          params: {
            address: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
            // Missing 'message' and 'signature'
          },
        });

        await expect(
          handler.route(origin, missingParamsRequest),
        ).rejects.toThrow('At path: message -- Expected a string');
      });
    });
  });

  describe('route', () => {
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.StartSendTransactionFlow,
      params: {
        account: validAccountId,
      },
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
        account: validAccountId,
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
      expect(mockSendFlowUseCases.display).toHaveBeenCalledWith(validAccountId);
      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalledWith(
        validAccountId,
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
        accountId: validAccountId,
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
        validAccountId,
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
        accountId: validAccountId,
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
        validAccountId,
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
          accountId: validAccountId,
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

  describe('onAddressInput', () => {
    const mockBitcoinAccount = {
      network: 'bitcoin',
    };

    const validAddressRequest = mock<JsonRpcRequest>({
      method: RpcMethod.OnAddressInput,
      params: {
        value: 'bc1qtest123address',
        accountId: validAccountId,
      },
    });

    beforeEach(() => {
      mockAccountsUseCases.get.mockResolvedValue(mockBitcoinAccount as any);
    });

    it('validates a correct address', async () => {
      const result = await handler.route(origin, validAddressRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
      expect(result).toStrictEqual({
        valid: true,
        errors: [],
      });
    });

    it('handles account not found error', async () => {
      const accountError = new Error('Account not found');
      mockAccountsUseCases.get.mockRejectedValue(accountError);

      const result = await handler.route(origin, validAddressRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid account and/or invalid address. Error: %s',
        'Account not found',
      );
      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      });
    });
  });

  describe('onAmountInput', () => {
    const validAmountRequest = mock<JsonRpcRequest>({
      method: RpcMethod.OnAmountInput,
      params: {
        value: '0.5',
        accountId: validAccountId,
        assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
      },
    });

    beforeEach(() => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);

      const mockAmountAccount = {
        network: 'bitcoin',
        balance: {
          trusted_spendable: {
            to_btc: jest.fn().mockReturnValue(1.5),
          },
        },
      };
      mockAccountsUseCases.get.mockResolvedValue(mockAmountAccount as any);
    });

    it('validates a correct amount within balance', async () => {
      const result = await handler.route(origin, validAmountRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
      expect(result).toStrictEqual({
        valid: true,
        errors: [],
      });
    });

    it('rejects amount exceeding balance', async () => {
      const excessiveAmountRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAmountInput,
        params: {
          value: '2.0', // more than account's balance
          accountId: validAccountId,
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      });

      const result = await handler.route(origin, excessiveAmountRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.InsufficientBalance }],
      });
    });

    it('handles account not found error', async () => {
      const accountError = new Error('Account not found');
      mockAccountsUseCases.get.mockRejectedValue(accountError);

      const result = await handler.route(origin, validAmountRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'An error occurred: %s',
        'Account not found',
      );
      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      });
    });
  });

  describe('verifyMessage', () => {
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.VerifyMessage,
      params: {
        address: 'bcrt1qs2fj7czz0amfm74j73yujx6dn6223md56gkkuy',
        message: 'Hello, world!',
        signature:
          'AkcwRAIgZxodJQ60t9Rr/hABEHZ1zPUJ4m5hdM5QLpysH8fDSzgCIENOEuZtYf9/Nn/ZW15PcImkknol403dmZrgoOQ+6K+TASECwDKypXm/ElmVTxTLJ7nao6X5mB/iGbU2Q2qtot0QRL4=',
      },
    });

    it('executes verifyMessage successfully with valid signature', async () => {
      const result = await handler.route(origin, mockRequest);

      expect(assert).toHaveBeenCalledWith(
        mockRequest.params,
        VerifyMessageRequest,
      );

      expect(result).toStrictEqual({ valid: true });
    });

    it('executes verifyMessage successfully with invalid signature', async () => {
      const result = await handler.route(origin, {
        ...mockRequest,
        params: {
          ...mockRequest.params,
          address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz', // wrong address for given signature
        },
      } as JsonRpcRequest);

      expect(result).toStrictEqual({ valid: false });
    });

    it('throws ValidationError for invalid signature', async () => {
      await expect(
        handler.route(origin, {
          ...mockRequest,
          params: { ...mockRequest.params, signature: 'invalidaSignature' },
        } as JsonRpcRequest),
      ).rejects.toThrow('Failed to verify signature');
    });
  });

  describe('confirmSend', () => {
    const mockAccount = mock<BitcoinAccount>({
      id: validAccountId,
      network: 'bitcoin' as any,
    });
    const mockTxBuilder = mock<TransactionBuilder>({
      feeRate: jest.fn(),
      unspendable: jest.fn(),
      addRecipient: jest.fn(),
      finish: jest.fn(),
    });
    const mockSignedPsbt = mock<Psbt>();
    const mockTransaction = mock<Transaction>();
    const mockKeyringTransaction: KeyringTransaction = {
      type: 'send',
      id: 'txid123',
      account: validAccountId,
      chain: 'btc:mainnet',
      status: TransactionStatus.Unconfirmed,
      timestamp: 1234567890,
      events: [
        {
          status: TransactionStatus.Unconfirmed,
          timestamp: 1234567890,
        },
      ],
      to: [],
      from: [],
      fees: [],
    };

    const validRequest: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.ConfirmSend,
      params: {
        fromAccountId: validAccountId,
        toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
        amount: '10000',
        assetId: Caip19Asset.Bitcoin,
      },
    };

    beforeEach(() => {
      mockAccountsUseCases.get.mockResolvedValue(mockAccount);
      mockAccountsUseCases.getFallbackFeeRate.mockResolvedValue(5);
      mockAccountsUseCases.getFrozenUTXOs.mockResolvedValue(['utxo1', 'utxo2']);

      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockTxBuilder.feeRate.mockReturnThis();
      mockTxBuilder.unspendable.mockReturnThis();
      mockTxBuilder.addRecipient.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockPsbt);

      mockAccount.sign.mockReturnValue(mockSignedPsbt);
      mockAccount.extractTransaction.mockReturnValue(mockTransaction);

      jest.mocked(mapPsbtToTransaction).mockReturnValue(mockKeyringTransaction);
    });

    it('creates and signs a transaction successfully', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);

      const result = await handler.route(origin, validRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
      expect(mockAccountsUseCases.getFallbackFeeRate).toHaveBeenCalledWith(
        mockAccount,
      );
      expect(mockAccountsUseCases.getFrozenUTXOs).toHaveBeenCalledWith(
        validAccountId,
      );

      expect(mockAccount.buildTx).toHaveBeenCalled();
      expect(mockTxBuilder.feeRate).toHaveBeenCalledWith(5);
      expect(mockTxBuilder.unspendable).toHaveBeenCalledWith([
        'utxo1',
        'utxo2',
      ]);
      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        '10000',
        'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
      );
      expect(mockTxBuilder.finish).toHaveBeenCalled();

      expect(mockAccount.sign).toHaveBeenCalledWith(mockPsbt);
      expect(mockAccount.extractTransaction).toHaveBeenCalledWith(
        mockSignedPsbt,
      );
      expect(mapPsbtToTransaction).toHaveBeenCalledWith(
        mockAccount,
        mockTransaction,
      );

      expect(result).toStrictEqual(mockKeyringTransaction);
    });

    it('handles different amounts and addresses', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);

      const customRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          amount: '50000',
          assetId: Caip19Asset.Bitcoin,
        },
      };

      await handler.route(origin, customRequest);

      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        '50000',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      );
    });

    it('throws error when account is not found', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);

      mockAccountsUseCases.get.mockRejectedValue(
        new Error('Account not found'),
      );

      await expect(handler.route(origin, validRequest)).rejects.toThrow(
        'Account not found',
      );

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'An error occurred: %s',
        'Account not found',
      );
    });

    it('throws error when buildTx fails', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);

      const buildError = new Error('Insufficient funds');
      mockTxBuilder.finish.mockImplementation(() => {
        throw buildError;
      });

      await expect(handler.route(origin, validRequest)).rejects.toThrow(
        'Insufficient funds',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'An error occurred: %s',
        'Insufficient funds',
      );
    });

    it('throws error when sign fails', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);

      const signError = new Error('Signing failed');
      mockAccount.sign.mockImplementation(() => {
        throw signError;
      });

      await expect(handler.route(origin, validRequest)).rejects.toThrow(
        'Signing failed',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'An error occurred: %s',
        'Signing failed',
      );
    });

    it('throws error when extractTransaction fails', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);

      const extractError = new Error('Failed to extract transaction');
      mockAccount.extractTransaction.mockImplementation(() => {
        throw extractError;
      });

      await expect(handler.route(origin, validRequest)).rejects.toThrow(
        'Failed to extract transaction',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'An error occurred: %s',
        'Failed to extract transaction',
      );
    });

    it('validates required parameters', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);
      const invalidRequests: JsonRpcRequest[] = [
        {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.ConfirmSend,
          params: {
            // missing fromAccountId
            toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
            amount: '10000',
            assetId: Caip19Asset.Bitcoin,
          } as any,
        },
        {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.ConfirmSend,
          params: {
            fromAccountId: validAccountId,
            // missing toAddress
            amount: '10000',
            assetId: Caip19Asset.Bitcoin,
          } as any,
        },
        {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.ConfirmSend,
          params: {
            fromAccountId: validAccountId,
            toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
            // missing amount
            assetId: Caip19Asset.Bitcoin,
          } as any,
        },
        {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.ConfirmSend,
          params: {
            fromAccountId: validAccountId,
            toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
            amount: '10000',
            // missing assetId
          } as any,
        },
      ];

      for (const invalidRequest of invalidRequests) {
        await expect(handler.route(origin, invalidRequest)).rejects.toThrow(
          'At path:',
        );
      }
    });

    it('validates accountId is a valid UUID', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);
      const invalidUuidRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: 'not-a-uuid',
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '10000',
          assetId: Caip19Asset.Bitcoin,
        } as any,
      };

      await expect(handler.route(origin, invalidUuidRequest)).rejects.toThrow(
        'Expected a string matching',
      );
    });

    it('validates amount is a non-empty string', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);
      const emptyAmountRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '',
          assetId: Caip19Asset.Bitcoin,
        } as any,
      };

      await expect(handler.route(origin, emptyAmountRequest)).rejects.toThrow(
        'Expected a nonempty string',
      );
    });

    it('validates toAddress is a non-empty string', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);
      const emptyAddressRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: '',
          amount: '10000',
          assetId: Caip19Asset.Bitcoin,
        } as any,
      };

      await expect(handler.route(origin, emptyAddressRequest)).rejects.toThrow(
        'Expected a nonempty string',
      );
    });

    it('validates assetId follows CAIP-19 format', async () => {
      const { assert: realAssert } = jest.requireActual('superstruct');
      jest.mocked(assert).mockImplementation(realAssert);
      const invalidAssetRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '10000',
          assetId: 'invalid-asset-id',
        } as any,
      };

      await expect(handler.route(origin, invalidAssetRequest)).rejects.toThrow(
        'Expected a value of type',
      );
    });
  });
});
