import { Psbt, Address } from '@metamask/bitcoindevkit';
import type { Amount, Txid } from '@metamask/bitcoindevkit';
import { BtcScope, FeeType } from '@metamask/keyring-api';
import type { JsonRpcRequest } from '@metamask/utils';
import { mock } from 'jest-mock-extended';
import { assert } from 'superstruct';

import type { Logger } from '../entities';
import type { AccountUseCases, SendFlowUseCases } from '../use-cases';
import { Caip19Asset } from './caip';
import {
  CreateSendFormRequest,
  ComputeFeeRequest,
  RpcHandler,
  RpcMethod,
  SendPsbtRequest,
  VerifyMessageRequest,
} from './RpcHandler';
import { SendErrorCodes } from './validation';

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

describe('RpcHandler', () => {
  const mockSendFlowUseCases = mock<SendFlowUseCases>();
  const mockAccountsUseCases = mock<AccountUseCases>();
  const mockLogger = mock<Logger>();
  const origin = 'metamask';

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

  describe('route', () => {
    const mockRequest = mock<JsonRpcRequest>({
      method: RpcMethod.StartSendTransactionFlow,
      params: {
        account: 'account-id',
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

    it('routes onAddressInput method correctly', async () => {
      const mockRoutingAccount = { network: 'bitcoin' };
      mockAccountsUseCases.get.mockResolvedValue(mockRoutingAccount as any);

      const addressInputRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAddressInput,
        params: {
          value: 'bc1qux9xtsj6mr4un7yg9kgd7tv8kndvlhv2gv5yc8',
          accountId: 'account-id',
        },
      });

      const result = await handler.route(origin, addressInputRequest);

      expect(result).toStrictEqual({
        valid: true,
        errors: [],
      });
    });

    it('routes onAmountInput method correctly', async () => {
      const mockRoutingAmountAccount = {
        network: 'bitcoin',
        balance: {
          trusted_spendable: {
            to_btc: jest.fn().mockReturnValue(1.0),
          },
        },
      };
      mockAccountsUseCases.get.mockResolvedValue(
        mockRoutingAmountAccount as any,
      );

      const amountInputRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAmountInput,
        params: {
          value: '0.5',
          accountId: 'account-id',
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      });

      const result = await handler.route(origin, amountInputRequest);

      expect(result).toStrictEqual({
        valid: true,
        errors: [],
      });
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

  describe('onAddressInput', () => {
    const mockBitcoinAccount = {
      network: 'bitcoin',
    };

    const validAddressRequest = mock<JsonRpcRequest>({
      method: RpcMethod.OnAddressInput,
      params: {
        value: 'bc1qtest123address',
        accountId: 'account-id',
      },
    });

    beforeEach(() => {
      mockAccountsUseCases.get.mockResolvedValue(mockBitcoinAccount as any);
    });

    it('validates a correct address', async () => {
      const result = await handler.route(origin, validAddressRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
      expect(result).toStrictEqual({
        valid: true,
        errors: [],
      });
    });

    it('rejects empty address', async () => {
      const emptyAddressRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAddressInput,
        params: {
          value: '',
          accountId: 'account-id',
        },
      });

      const result = await handler.route(origin, emptyAddressRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Required }],
      });
      expect(mockAccountsUseCases.get).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only address', async () => {
      const whitespaceAddressRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAddressInput,
        params: {
          value: '   ',
          accountId: 'account-id',
        },
      });

      const result = await handler.route(origin, whitespaceAddressRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Required }],
      });
    });

    it('rejects empty accountId', async () => {
      const emptyAccountRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAddressInput,
        params: {
          value: 'bc1qtest123address',
          accountId: '',
        },
      });

      const result = await handler.route(origin, emptyAccountRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Required }],
      });
    });

    it('rejects invalid address format', async () => {
      const invalidAddressRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAddressInput,
        params: {
          value: 'not-a-valid-address',
          accountId: 'account-id',
        },
      });

      const result = await handler.route(origin, invalidAddressRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid account and/or invalid address. Error: %s',
        expect.any(String),
      );
      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      });
    });

    it('handles account not found error', async () => {
      const accountError = new Error('Account not found');
      mockAccountsUseCases.get.mockRejectedValue(accountError);

      const result = await handler.route(origin, validAddressRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
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
        accountId: 'account-id',
        assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
      },
    });

    beforeEach(() => {
      jest.clearAllMocks();
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

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
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
          accountId: 'account-id',
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      });

      const result = await handler.route(origin, excessiveAmountRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.InsufficientBalance }],
      });
    });

    it('rejects negative amounts', async () => {
      const negativeAmountRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAmountInput,
        params: {
          value: '-0.5',
          accountId: 'account-id',
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
          accountId: 'account-id',
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
      // empty string is tested separately as it returns 'Required' error
      const testCases = ['abc', '1.2.3', 'not-a-number', 'NaN', 'Infinity'];

      for (const invalidValue of testCases) {
        const invalidAmountRequest = mock<JsonRpcRequest>({
          method: RpcMethod.OnAmountInput,
          params: {
            value: invalidValue,
            accountId: 'account-id',
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

    it('rejects empty accountId', async () => {
      const emptyAccountRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAmountInput,
        params: {
          value: '0.5',
          accountId: '',
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      });

      const result = await handler.route(origin, emptyAccountRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Required }],
      });
    });

    it('rejects whitespace-only values', async () => {
      const whitespaceValueRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAmountInput,
        params: {
          value: '   ',
          accountId: 'account-id',
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      });

      const result = await handler.route(origin, whitespaceValueRequest);

      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Required }],
      });
    });

    it('handles account not found error', async () => {
      const accountError = new Error('Account not found');
      mockAccountsUseCases.get.mockRejectedValue(accountError);

      const result = await handler.route(origin, validAmountRequest);

      expect(mockAccountsUseCases.get).toHaveBeenCalledWith('account-id');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'An error occurred: %s',
        'Account not found',
      );
      expect(result).toStrictEqual({
        valid: false,
        errors: [{ code: SendErrorCodes.Invalid }],
      });
    });

    it('accepts decimal amounts', async () => {
      const decimalAmountRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAmountInput,
        params: {
          value: '0.00001',
          accountId: 'account-id',
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      });

      const result = await handler.route(origin, decimalAmountRequest);

      expect(result).toStrictEqual({
        valid: true,
        errors: [],
      });
    });

    it('accepts scientific notation', async () => {
      const scientificAmountRequest = mock<JsonRpcRequest>({
        method: RpcMethod.OnAmountInput,
        params: {
          value: '1e-8', // 0.00000001 in scientific notation
          accountId: 'account-id',
          assetId: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      });

      const result = await handler.route(origin, scientificAmountRequest);

      expect(result).toStrictEqual({
        valid: true,
        errors: [],
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
});
