import { Psbt, Address, Amount } from '@metamask/bitcoindevkit';
import type { Transaction, Txid } from '@metamask/bitcoindevkit';
import type { Transaction as KeyringTransaction } from '@metamask/keyring-api';
import { BtcScope, FeeType } from '@metamask/keyring-api';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';

import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { Caip19Asset } from './caip';
import { RpcHandler } from './RpcHandler';
import { RpcMethod, SendErrorCodes } from './validation';
import type { Logger, BitcoinAccount, TransactionBuilder } from '../entities';
import { mapPsbtToTransaction } from './mappings';

const mockPsbt = mock<Psbt>();
// TODO: enable when this is merged: https://github.com/rustwasm/wasm-bindgen/issues/1818
/* eslint-disable @typescript-eslint/naming-convention */
jest.mock('@metamask/bitcoindevkit', () => ({
  Psbt: { from_string: jest.fn() },
  Address: {
    from_string: jest.fn(),
  },
  Amount: {
    from_btc: jest.fn(),
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
    describe('onAddressInput validation', () => {
      beforeEach(() => {
        const mockAccount = mock<BitcoinAccount>({ network: 'bitcoin' });
        mockAccountsUseCases.get.mockResolvedValue(mockAccount);
      });

      it('rejects invalid address format', async () => {
        const invalidAddressRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAddressInput,
          params: {
            value: 'not-a-valid-address',
            accountId: validAccountId,
          },
        };

        const result = await handler.route(origin, invalidAddressRequest);

        expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Invalid address for network %s. Error: %s',
          'bitcoin',
          'Invalid address: not-a-valid-address',
        );
        expect(result).toStrictEqual({
          valid: false,
          errors: [{ code: SendErrorCodes.Invalid }],
        });
      });

      it('rejects invalid UUID accountId', async () => {
        const invalidRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAddressInput,
          params: {
            value: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
            accountId: 'not-a-uuid',
          },
        };

        await expect(handler.route(origin, invalidRequest)).rejects.toThrow(
          'Expected a string matching',
        );
      });

      it('rejects missing value parameter', async () => {
        const missingValueRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAddressInput,
          params: {
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            // Missing 'value' field
          } as any,
        };

        await expect(
          handler.route(origin, missingValueRequest),
        ).rejects.toThrow('At path: value -- Expected a string');
      });

      it('rejects missing accountId parameter', async () => {
        const missingAccountRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAddressInput,
          params: {
            value: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
            // Missing 'accountId' field
          } as any,
        };

        await expect(
          handler.route(origin, missingAccountRequest),
        ).rejects.toThrow('At path: accountId -- Expected a string');
      });
    });

    describe('onAmountInput validation', () => {
      it('rejects invalid UUID accountId', async () => {
        const invalidRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAmountInput,
          params: {
            value: '1.5',
            accountId: 'not-a-uuid',
            assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
          },
        };

        await expect(handler.route(origin, invalidRequest)).rejects.toThrow(
          'Expected a string matching',
        );
      });

      it('rejects negative amounts', async () => {
        const negativeAmountRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAmountInput,
          params: {
            value: '-0.5',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
          },
        };

        const result = await handler.route(origin, negativeAmountRequest);

        expect(result).toStrictEqual({
          valid: false,
          errors: [{ code: SendErrorCodes.Invalid }],
        });
      });

      it('rejects zero amount', async () => {
        const zeroAmountRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAmountInput,
          params: {
            value: '0',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
          },
        };

        const result = await handler.route(origin, zeroAmountRequest);

        expect(result).toStrictEqual({
          valid: false,
          errors: [{ code: SendErrorCodes.Invalid }],
        });
      });

      it('rejects invalid number formats', async () => {
        const testCases = ['abc', '1.2.3', 'not-a-number', 'NaN', 'Infinity'];

        for (const invalidValue of testCases) {
          const invalidAmountRequest: JsonRpcRequest = {
            id: 1,
            jsonrpc: '2.0',
            method: RpcMethod.OnAmountInput,
            params: {
              value: invalidValue,
              accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
              assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
            },
          };

          const result = await handler.route(origin, invalidAmountRequest);

          expect(result).toStrictEqual({
            valid: false,
            errors: [{ code: SendErrorCodes.Invalid }],
          });
        }
      });

      it('rejects missing assetId parameter', async () => {
        const missingAssetRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAmountInput,
          params: {
            value: '1.5',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            // Missing 'assetId' field
          } as any,
        };

        await expect(
          handler.route(origin, missingAssetRequest),
        ).rejects.toThrow(
          'At path: assetId -- Expected a value of type `CaipAssetType`',
        );
      });

      it('rejects invalid assetId format', async () => {
        const invalidAssetRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.OnAmountInput,
          params: {
            value: '1.5',
            accountId: 'e36749ce-7c63-41df-b23c-6446c69b8e96',
            assetId: 'invalid-asset-id',
          },
        };

        await expect(
          handler.route(origin, invalidAssetRequest),
        ).rejects.toThrow(
          'At path: assetId -- Expected a value of type `CaipAssetType`',
        );
      });
    });

    describe('verifyMessage validation', () => {
      it('rejects missing parameters', async () => {
        const missingParamsRequest: JsonRpcRequest = {
          id: 1,
          jsonrpc: '2.0',
          method: RpcMethod.VerifyMessage,
          params: {
            address: 'bcrt1qjtgffm20l9vu6a7gacxvpu2ej4kdcsgcgnly6t',
            // Missing 'message' and 'signature'
          } as any,
        };

        await expect(
          handler.route(origin, missingParamsRequest),
        ).rejects.toThrow('At path: message -- Expected a string');
      });
    });
  });

  describe('route', () => {
    const request: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.StartSendTransactionFlow,
      params: {
        account: validAccountId,
      },
    };

    it('throws error if missing params', async () => {
      await expect(
        handler.route(origin, { ...request, params: undefined }),
      ).rejects.toThrow('Missing params');
    });

    it('throws error if unrecognized method', async () => {
      await expect(
        handler.route(origin, { ...request, method: 'randomMethod' }),
      ).rejects.toThrow('Method not found: randomMethod');
    });
  });

  describe('executeSendFlow', () => {
    const request: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.StartSendTransactionFlow,
      params: {
        account: validAccountId,
      },
    };

    it('executes startSendTransactionFlow', async () => {
      mockSendFlowUseCases.display.mockResolvedValue(mockPsbt);
      mockAccountsUseCases.signPsbt.mockResolvedValue({
        psbt: 'psbtBase64',
        txid: mock<Txid>({
          toString: jest.fn().mockReturnValue('txId'),
        }),
      });

      const result = await handler.route(origin, request);

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

      await expect(handler.route(origin, request)).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.signPsbt).not.toHaveBeenCalled();
    });

    it('propagates errors from send', async () => {
      const error = new Error();
      mockSendFlowUseCases.display.mockResolvedValue(mockPsbt);
      mockAccountsUseCases.signPsbt.mockRejectedValue(error);

      await expect(handler.route(origin, request)).rejects.toThrow(error);

      expect(mockSendFlowUseCases.display).toHaveBeenCalled();
      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalled();
    });
  });

  describe('signAndSendTransaction', () => {
    const psbt =
      'cHNidP8BAI4CAAAAAAM1gwEAAAAAACJRIORP1Ndiq325lSC/jMG0RlhATHYmuuULfXgEHUM3u5i4AAAAAAAAAAAxai8AAUSx+i9Igg4HWdcpyagCs8mzuRCklgA7nRMkm69rAAAAAAAAAAAAAQACAAAAACp2AAAAAAAAFgAUgu3FEiFNy9ZR/zSpTo9nHREjrSoAAAAAAAAAAAA=';
    const request: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.SignAndSendTransaction,
      params: {
        accountId: validAccountId,
        transaction: psbt,
      },
    };

    it('executes signAndSendTransaction', async () => {
      mockAccountsUseCases.signPsbt.mockResolvedValue({
        psbt: 'psbtBase64',
        txid: mock<Txid>({
          toString: jest.fn().mockReturnValue('txId'),
        }),
      });

      const result = await handler.route(origin, request);

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

      await expect(handler.route(origin, request)).rejects.toThrow(error);

      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalled();
    });
  });

  describe('computeFee', () => {
    const psbt = 'someEncodedPsbt';
    const request: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.ComputeFee,
      params: {
        accountId: validAccountId,
        transaction: psbt,
        scope: BtcScope.Mainnet,
      },
    };

    it('executes computeFee', async () => {
      const mockAmount = mock<Amount>({
        to_btc: jest.fn().mockReturnValue('0.00001'),
      });
      mockAccountsUseCases.computeFee.mockResolvedValue(mockAmount);

      const result = await handler.route(origin, request);

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

      await expect(handler.route(origin, request)).rejects.toThrow(error);

      expect(mockAccountsUseCases.computeFee).toHaveBeenCalled();
    });

    it('throws FormatError for invalid PSBT', async () => {
      const invalidRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ComputeFee,
        params: {
          accountId: validAccountId,
          transaction: 'invalid-psbt-base64',
          scope: BtcScope.Mainnet,
        },
      };

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

    const validAddressRequest: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.OnAddressInput,
      params: {
        value: 'bc1qtest123address',
        accountId: validAccountId,
      },
    };

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
        'Invalid account. Error: %s',
        'Account not found',
      );
      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      });
    });
  });

  describe('onAmountInput', () => {
    const validAmountRequest: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.OnAmountInput,
      params: {
        value: '0.5',
        accountId: validAccountId,
        assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
      },
    };

    beforeEach(() => {
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
      const excessiveAmountRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.OnAmountInput,
        params: {
          value: '2.0', // more than account's balance
          accountId: validAccountId,
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      };

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
    const request: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.VerifyMessage,
      params: {
        address: 'bcrt1qs2fj7czz0amfm74j73yujx6dn6223md56gkkuy',
        message: 'Hello, world!',
        signature:
          'AkcwRAIgZxodJQ60t9Rr/hABEHZ1zPUJ4m5hdM5QLpysH8fDSzgCIENOEuZtYf9/Nn/ZW15PcImkknol403dmZrgoOQ+6K+TASECwDKypXm/ElmVTxTLJ7nao6X5mB/iGbU2Q2qtot0QRL4=',
      },
    };

    it('executes verifyMessage successfully with valid signature', async () => {
      const result = await handler.route(origin, request);

      expect(result).toStrictEqual({ valid: true });
    });

    it('executes verifyMessage successfully with invalid signature', async () => {
      const result = await handler.route(origin, {
        ...request,
        params: {
          ...request.params,
          address: 'bcrt1qstku2y3pfh9av50lxj55arm8r5gj8tf2yv5nxz', // wrong address for given signature
        },
      } as JsonRpcRequest);

      expect(result).toStrictEqual({ valid: false });
    });

    it('throws ValidationError for invalid signature', async () => {
      await expect(
        handler.route(origin, {
          ...request,
          params: { ...request.params, signature: 'invalidaSignature' },
        } as JsonRpcRequest),
      ).rejects.toThrow('Failed to verify signature');
    });
  });

  describe('confirmSend', () => {
    const mockAccount = mock<BitcoinAccount>();
    const mockTxBuilder = mock<TransactionBuilder>();
    const mockTemplatePsbt = mock<Psbt>();
    const mockSignedPsbt = mock<Psbt>();
    const mockTransaction = mock<Transaction>();

    const validRequest: JsonRpcRequest = {
      id: 1,
      jsonrpc: '2.0',
      method: RpcMethod.ConfirmSend,
      params: {
        fromAccountId: validAccountId,
        toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
        amount: '0.0001',
        assetId: Caip19Asset.Bitcoin,
      },
    };

    beforeEach(() => {
      mockAccount.id = validAccountId;
      mockAccount.network = 'bitcoin';

      const mockBalanceAmount = mock<Amount>();
      mockBalanceAmount.to_sat.mockReturnValue(BigInt(100_000_000)); // 1 BTC in satoshis
      mockAccount.balance = {
        trusted_spendable: mockBalanceAmount,
      } as any;

      mockAccountsUseCases.get.mockResolvedValue(mockAccount);
      mockAccountsUseCases.signPsbt.mockResolvedValue({
        psbt: 'signed-psbt-string',
        txid: undefined,
      });

      mockAccount.buildTx.mockReturnValue(mockTxBuilder);
      mockTxBuilder.addRecipient.mockReturnThis();
      mockTxBuilder.finish.mockReturnValue(mockTemplatePsbt);

      const mockFeeAmount = mock<Amount>();
      mockFeeAmount.to_sat.mockReturnValue(BigInt(500)); // 500 satoshis fee
      mockSignedPsbt.fee.mockReturnValue(mockFeeAmount);
      jest.mocked(Psbt.from_string).mockReturnValue(mockSignedPsbt);
      mockAccount.extractTransaction.mockReturnValue(mockTransaction);

      (Amount.from_btc as jest.Mock).mockImplementation((btc) => ({
        to_sat: () => BigInt(Math.round(btc * 100_000_000)),
      }));

      // we mock the mapping function since we don't care about the result structure here
      // it is tested in mappings.test.ts
      jest
        .mocked(mapPsbtToTransaction)
        .mockReturnValue({} as KeyringTransaction);
    });

    it('creates and signs a transaction successfully', async () => {
      const result = await handler.route(origin, validRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith(validAccountId);

      expect(mockAccount.buildTx).toHaveBeenCalled();
      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        '10000', // 0.0001 BTC in satoshis (addRecipient requires satoshis)
        'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
      );
      expect(mockTxBuilder.finish).toHaveBeenCalled();

      expect(mockAccountsUseCases.signPsbt).toHaveBeenCalledWith(
        validAccountId,
        mockTemplatePsbt,
        'metamask',
        {
          fill: true,
          broadcast: false,
        },
      );

      expect(Psbt.from_string).toHaveBeenCalledWith('signed-psbt-string');
      expect(mockAccount.extractTransaction).toHaveBeenCalledWith(
        mockSignedPsbt,
      );
      expect(mapPsbtToTransaction).toHaveBeenCalledWith(
        mockAccount,
        mockTransaction,
      );

      expect(result).toBeDefined();
    });

    it('handles different amounts and addresses', async () => {
      const customRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          amount: '0.0005',
          assetId: Caip19Asset.Bitcoin,
        },
      };

      await handler.route(origin, customRequest);

      expect(mockTxBuilder.addRecipient).toHaveBeenCalledWith(
        '50000', // 0.0005 BTC in satoshis
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      );
    });

    it('throws error when account is not found', async () => {
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
      const signError = new Error('Signing failed');
      mockAccountsUseCases.signPsbt.mockRejectedValue(signError);

      await expect(handler.route(origin, validRequest)).rejects.toThrow(
        'Signing failed',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'An error occurred: %s',
        'Signing failed',
      );
    });

    it('throws error when extractTransaction fails', async () => {
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

    it('validates request parameters', async () => {
      const missingFieldRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          // missing fromAccountId
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '0.0001',
          assetId: Caip19Asset.Bitcoin,
        } as any,
      };

      await expect(handler.route(origin, missingFieldRequest)).rejects.toThrow(
        'At path:',
      );

      // invalid UUID format
      const invalidUuidRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: 'not-a-uuid',
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '0.0001',
          assetId: Caip19Asset.Bitcoin,
        },
      };

      await expect(handler.route(origin, invalidUuidRequest)).rejects.toThrow(
        'Expected a string matching',
      );
    });

    it('returns validation error for invalid amount', async () => {
      const invalidAmountRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '-0.0001',
          assetId: Caip19Asset.Bitcoin,
        },
      };

      const result = await handler.route(origin, invalidAmountRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      });
    });

    it('returns validation error for invalid address', async () => {
      const invalidAddressRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: 'invalid-address',
          amount: '0.0001',
          assetId: Caip19Asset.Bitcoin,
        },
      };

      const result = await handler.route(origin, invalidAddressRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      });
    });

    it('returns validation error for insufficient fee balance', async () => {
      // small balance that won't cover amount + fees
      const smallBalanceAmount = mock<Amount>();
      smallBalanceAmount.to_sat.mockReturnValue(BigInt(5000)); // 0.00005 BTC in satoshis
      smallBalanceAmount.to_btc.mockReturnValue(0.00005);

      const mockBalance = {
        trusted_spendable: smallBalanceAmount,
        free: mock<Amount>(),
        immature: mock<Amount>(),
        trusted_pending: mock<Amount>(),
        untrusted_pending: mock<Amount>(),
        coin_count: 1,
        coin_value: mock<Amount>(),
      };

      const smallBalanceAccount = mock<BitcoinAccount>();
      smallBalanceAccount.id = validAccountId;
      smallBalanceAccount.network = 'bitcoin';
      smallBalanceAccount.balance = mockBalance as any;
      smallBalanceAccount.buildTx.mockReturnValue(mockTxBuilder);
      smallBalanceAccount.extractTransaction.mockReturnValue(mockTransaction);

      mockAccountsUseCases.get.mockResolvedValue(smallBalanceAccount);

      const mockSignedPsbtWithFee = mock<Psbt>();
      const mockFeeAmount = mock<Amount>();
      mockFeeAmount.to_sat.mockReturnValue(BigInt(1000)); // 0.00001 BTC fee in satoshis
      mockSignedPsbtWithFee.fee.mockReturnValue(mockFeeAmount);
      jest.mocked(Psbt.from_string).mockReturnValue(mockSignedPsbtWithFee);

      const insufficientBalanceRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '0.00005', // 0.00005 BTC (5000 sats) + 0.00001 BTC fee (1000 sats) > 0.00005 BTC balance (5000 sats)
          assetId: Caip19Asset.Bitcoin,
        },
      };

      const result = await handler.route(origin, insufficientBalanceRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.InsufficientBalanceToCoverFee }],
      });
    });

    it('returns validation error for insufficient balance', async () => {
      const smallBalanceAmount = mock<Amount>();
      smallBalanceAmount.to_sat.mockReturnValue(BigInt(5000)); // 0.00005 BTC in satoshis
      smallBalanceAmount.to_btc.mockReturnValue(0.00005);

      const mockBalance = {
        trusted_spendable: smallBalanceAmount,
        free: mock<Amount>(),
        immature: mock<Amount>(),
        trusted_pending: mock<Amount>(),
        untrusted_pending: mock<Amount>(),
        coin_count: 1,
        coin_value: mock<Amount>(),
      };

      const smallBalanceAccount = mock<BitcoinAccount>();
      smallBalanceAccount.id = validAccountId;
      smallBalanceAccount.network = 'bitcoin';
      smallBalanceAccount.balance = mockBalance as any;
      smallBalanceAccount.buildTx.mockReturnValue(mockTxBuilder);
      smallBalanceAccount.extractTransaction.mockReturnValue(mockTransaction);

      mockAccountsUseCases.get.mockResolvedValue(smallBalanceAccount);

      const mockSignedPsbtWithFee = mock<Psbt>();
      const mockFeeAmount = mock<Amount>();
      mockFeeAmount.to_sat.mockReturnValue(BigInt(1000)); // 0.00001 BTC fee in satoshis
      mockSignedPsbtWithFee.fee.mockReturnValue(mockFeeAmount);
      jest.mocked(Psbt.from_string).mockReturnValue(mockSignedPsbtWithFee);

      const insufficientBalanceRequest: JsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: RpcMethod.ConfirmSend,
        params: {
          fromAccountId: validAccountId,
          toAddress: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          amount: '0.00006', // 0.00006 BTC (6000 sats) + 0.00001 BTC fee (1000 sats) > 0.00005 BTC balance (5000 sats)
          assetId: Caip19Asset.Bitcoin,
        },
      };

      const result = await handler.route(origin, insufficientBalanceRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.InsufficientBalance }],
      });
    });
  });
});
