import { expect } from '@jest/globals';
import { BtcAccountType, BtcMethod, BtcScope } from '@metamask/keyring-api';
import { BigNumber } from 'bignumber.js';
import { v4 as uuidv4 } from 'uuid';

import { Caip2ChainId, Caip2ChainIdToNetworkName } from '../constants';
import type { SendBitcoinParams } from '../rpcs';
import { TransactionStatus } from '../stateManagement';
import { generateDefaultSendFlowRequest } from '../utils/transaction';
import { AssetType, SendFormError } from './types';
import {
  validateAmount,
  validateRecipient,
  btcToFiat,
  fiatToBtc,
  generateSendBitcoinParams,
  sendBitcoinParamsToSendFlowParams,
  formValidation,
  getNetworkNameFromScope,
} from './utils';

const mockEstimateFee = jest.fn();
jest.mock('../rpcs/estimate-fee', () => ({
  estimateFee: () => mockEstimateFee(),
}));

const mockInterfaceId = 'interfaceId';
const mockScope = Caip2ChainId.Mainnet;
const mockRequestId = 'requestId';
const mockAccount = {
  type: BtcAccountType.P2wpkh,
  id: uuidv4(),
  address: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
  options: {
    scope: Caip2ChainId.Mainnet,
    index: '1',
  },
  methods: [`${BtcMethod.SendBitcoin}`],
  scopes: [BtcScope.Mainnet],
};

describe('utils', () => {
  describe('validateAmount', () => {
    it('should return error if amount is not a number', () => {
      const result = validateAmount('abc', '100', '62000');
      expect(result).toStrictEqual({
        amount: '',
        fiat: '',
        error: SendFormError.InvalidAmount,
        valid: false,
      });
    });

    it('should return error if amount is less than or equal to 0', () => {
      const result = validateAmount('0', '100', '62000');
      expect(result).toStrictEqual({
        amount: '0',
        fiat: '0',
        error: SendFormError.ZeroAmount,
        valid: false,
      });
    });

    it('should return error if amount is greater than balance', () => {
      const result = validateAmount('200', '100', '62000');
      expect(result).toStrictEqual({
        amount: '200',
        fiat: '12400000.00',
        error: SendFormError.InsufficientFunds,
        valid: false,
      });
    });

    it('should return valid amount if amount is valid', () => {
      const result = validateAmount('50', '100', '62000');
      expect(result).toStrictEqual({
        amount: '50',
        fiat: '3100000.00',
        error: '',
        valid: true,
      });
    });
  });

  describe('validateRecipient', () => {
    it('should return valid for a correct mainnet address', () => {
      const result = validateRecipient(
        'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        Caip2ChainId.Mainnet,
      );
      expect(result).toStrictEqual({
        address: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        error: '',
        valid: true,
      });
    });

    it('should return valid for a correct testnet address', () => {
      const result = validateRecipient(
        'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
        Caip2ChainId.Testnet,
      );
      expect(result).toStrictEqual({
        address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
        error: '',
        valid: true,
      });
    });

    it('should return error for an invalid mainnet address', () => {
      const result = validateRecipient('invalidAddress', Caip2ChainId.Mainnet);
      expect(result).toStrictEqual({
        address: 'invalidAddress',
        error: SendFormError.InvalidAddress,
        valid: false,
      });
    });

    it('should return error for an invalid testnet address', () => {
      const result = validateRecipient('invalidAddress', Caip2ChainId.Testnet);
      expect(result).toStrictEqual({
        address: 'invalidAddress',
        error: SendFormError.InvalidAddress,
        valid: false,
      });
    });

    it('should return error for a valid mainnet address in testnet scope', () => {
      const result = validateRecipient(
        'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        Caip2ChainId.Testnet,
      );
      expect(result).toStrictEqual({
        address: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        error: SendFormError.InvalidAddress,
        valid: false,
      });
    });

    it('should return error for a valid testnet address in mainnet scope', () => {
      const result = validateRecipient(
        'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
        Caip2ChainId.Mainnet,
      );
      expect(result).toStrictEqual({
        address: 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
        error: SendFormError.InvalidAddress,
        valid: false,
      });
    });

    it('should handle empty address', () => {
      const result = validateRecipient('', Caip2ChainId.Mainnet);
      expect(result).toStrictEqual({
        address: '',
        error: SendFormError.InvalidAddress,
        valid: false,
      });
    });

    it('should handle null address', () => {
      const result = validateRecipient(
        null as unknown as string,
        Caip2ChainId.Mainnet,
      );
      expect(result).toStrictEqual({
        address: '',
        error: SendFormError.InvalidAddress,
        valid: false,
      });
    });

    it('should handle undefined address', () => {
      const result = validateRecipient(
        undefined as unknown as string,
        Caip2ChainId.Mainnet,
      );
      expect(result).toStrictEqual({
        address: '',
        error: SendFormError.InvalidAddress,
        valid: false,
      });
    });
  });

  describe('sendStateToSendBitcoinParams', () => {
    it('should convert send state to SendBitcoinParams correctly', async () => {
      const request = {
        ...generateDefaultSendFlowRequest(
          mockAccount,
          mockScope,
          mockRequestId,
          mockInterfaceId,
        ),
        recipient: {
          address: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
          error: '',
          valid: true,
        },
        amount: { amount: '0.1', fiat: '6200.00', error: '', valid: true },
        fees: { amount: '0.0001', fiat: '6.20', loading: false, error: '' },
        selectedCurrency: AssetType.BTC,
        rates: '62000',
        balance: { amount: '1', fiat: '62000.00' },
      };
      const scope = Caip2ChainId.Mainnet;

      const result = generateSendBitcoinParams(scope, request);

      expect(result).toStrictEqual({
        recipients: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '0.1' },
        replaceable: true,
        dryrun: false,
        scope,
      });
    });
  });

  describe('sendBitcoinParamsToSendFlowParams', () => {
    const mockFee = {
      fee: {
        amount: '0.0001',
        unit: 'BTC',
      },
    };

    beforeEach(() => {
      mockEstimateFee.mockResolvedValue(mockFee);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should convert SendBitcoinParams to SendFlowParams correctly', async () => {
      const params: Omit<SendBitcoinParams, 'scope'> = {
        recipients: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '0.1' },
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = await sendBitcoinParamsToSendFlowParams(
        params,
        account,
        scope,
        rates,
        balance,
      );

      const expectedAmount = Object.values(params.recipients)[0];
      const expectedTotal = new BigNumber(expectedAmount)
        .plus(new BigNumber(mockFee.fee.amount))
        .toString();

      expect(result).toStrictEqual({
        rates,
        recipient: {
          address: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
          error: '',
          valid: true,
        },
        balance: {
          amount: balance,
          fiat: btcToFiat(balance, rates),
        },
        fees: {
          amount: mockFee.fee.amount,
          fiat: btcToFiat(mockFee.fee.amount, rates),
          loading: false,
          error: '',
        },
        amount: {
          amount: expectedAmount,
          fiat: btcToFiat(expectedAmount, rates),
          error: '',
          valid: true,
        },
        total: {
          amount: expectedTotal,
          fiat: btcToFiat(expectedTotal, rates),
          valid: true,
          error: '',
        },
        selectedCurrency: AssetType.BTC,
        scope,
      });
    });

    it('should handle invalid recipient address', async () => {
      const params = {
        recipients: { invalidAddress: '0.1' },
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = await sendBitcoinParamsToSendFlowParams(
        params,
        account,
        scope,
        rates,
        balance,
      );
      expect(result.recipient.error).toBe('Invalid address');
    });

    it('should handle invalid amount', async () => {
      const params = {
        recipients: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '0' },
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = await sendBitcoinParamsToSendFlowParams(
        params,
        account,
        scope,
        rates,
        balance,
      );

      expect(result.amount.error).toBe('Amount must be greater than 0');
    });

    it('should handle insufficient balance', async () => {
      const params = {
        recipients: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '2' },
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = sendBitcoinParamsToSendFlowParams(
        params,
        account,
        scope,
        rates,
        balance,
      );
      expect((await result).amount.error).toBe(SendFormError.InsufficientFunds);
    });
  });

  describe('btcToFiat', () => {
    it.each([
      { amount: '1', rate: '62000', expected: '62000.00' },
      { amount: '0.1', rate: '62000', expected: '6200.00' },
      { amount: '1.1', rate: '62000', expected: '68200.00' },
      { amount: '1', rate: '0', expected: '0.00' },
      { amount: '0', rate: '62000', expected: '0.00' },
      { amount: '12', rate: '62000.888', expected: '744010.66' },
      { amount: '12', rate: '0.888', expected: '10.66' },
    ])(
      'should convert $amount btc to $rate fiat',
      ({ amount, rate, expected }) => {
        expect(btcToFiat(amount, rate)).toStrictEqual(expected);
      },
    );
  });

  describe('fiatToBtc', () => {
    it.each([
      { amount: '1', rate: '62000', expected: '0.00001613' },
      { amount: '0.1', rate: '62000', expected: '0.00000161' },
      { amount: '1.1', rate: '62000', expected: '0.00001774' },
      { amount: '0', rate: '62000', expected: '0.00000000' },
      { amount: '12', rate: '62000.888', expected: '0.00019355' },
      { amount: '12', rate: '0.888', expected: '13.51351351' },
    ])(
      'should convert $amount fiat to $rate btc',
      ({ amount, rate, expected }) => {
        expect(fiatToBtc(amount, rate)).toStrictEqual(expected);
      },
    );
  });

  describe('formValidation', () => {
    const context = { scope: Caip2ChainId.Mainnet };
    const rates = '62000';
    const balance = '1';

    it('should validate form correctly with valid data', () => {
      const formState = {
        accountSelector: 'testAccount',
        amount: '0.1',
        to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
      };
      const request = {
        id: 'test-id',
        interfaceId: 'test-interface-id',
        account: mockAccount,
        scope: Caip2ChainId.Mainnet,
        status: TransactionStatus.Draft,
        transaction: {
          recipients: {},
          replaceable: true,
          dryrun: false,
        },
        total: { amount: '', fiat: '', error: '', valid: false },
        recipient: { address: '', error: '', valid: false },
        amount: { amount: '', fiat: '', error: '', valid: false },
        fees: { amount: '', fiat: '', loading: false, error: '' },
        selectedCurrency: AssetType.BTC,
        rates,
        balance: { amount: balance, fiat: '62000.00' },
      };
      const result = formValidation(
        formState,
        {
          ...context,
          request,
          accounts: [mockAccount],
          requestId: 'test-id',
        },
        request,
      );

      expect(result).toStrictEqual({
        ...request,
        recipient: {
          address: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
          error: '',
          valid: true,
        },
        amount: {
          amount: '0.1',
          fiat: '6200.00',
          error: '',
          valid: true,
        },
        fees: { amount: '', fiat: '', loading: false, error: '' },
        selectedCurrency: AssetType.BTC,
        rates,
        balance: { amount: balance, fiat: '62000.00' },
        // We are only validating the inputs here.
        total: {
          amount: '',
          fiat: '',
          error: '',
          valid: false,
        },
      });
    });

    it.each([
      {
        formState: {
          amount: 'abc',
          to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        },
        expectedAmountError: SendFormError.InvalidAmount,
        expectedRecipientError: '',
      },
      {
        formState: {
          amount: '0',
          to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        },
        expectedAmountError: SendFormError.ZeroAmount,
        expectedRecipientError: '',
      },
      {
        formState: {
          amount: '2',
          to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        },
        expectedAmountError: SendFormError.InsufficientFunds,
        expectedRecipientError: '',
      },
      {
        formState: { amount: '0.1', to: 'invalidAddress' },
        expectedAmountError: '',
        expectedRecipientError: SendFormError.InvalidAddress,
      },
    ])(
      'should handle error cases for form validation',
      ({ formState, expectedAmountError, expectedRecipientError }) => {
        const request = {
          id: 'test-id',
          interfaceId: 'test-interface-id',
          account: mockAccount,
          scope: Caip2ChainId.Mainnet,
          recipient: { address: '', error: '', valid: false },
          amount: { amount: '', fiat: '', error: '', valid: false },
          fees: { amount: '', fiat: '', loading: false, error: '' },
          selectedCurrency: AssetType.BTC,
          rates,
          balance: { amount: balance, fiat: '62000.00' },
        };
        // @ts-expect-error test only request params and not the whole object
        const result = formValidation(formState, context, request);

        expect(result.amount.error).toBe(expectedAmountError);
        expect(result.recipient.error).toBe(expectedRecipientError);
      },
    );

    it('should reset fees if amount is invalid', () => {
      const formState = {
        amount: 'abc',
        to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
      };
      const request = {
        recipient: { address: '', error: '', valid: false },
        amount: { amount: '', fiat: '', error: '', valid: false },
        fees: { amount: '0.0001', fiat: '6.20', loading: false, error: '' },
        selectedCurrency: AssetType.BTC,
        rates,
        balance: { amount: balance, fiat: '62000.00' },
      };
      // @ts-expect-error test only request params and not the whole object
      const result = formValidation(formState, context, request);

      expect(result.fees).toStrictEqual({
        amount: '',
        fiat: '',
        loading: false,
        error: '',
      });
    });
  });

  describe('getNetworkNameFromScope', () => {
    const expectedError = 'Unknown Network';

    it('should return "Mainnet" for Caip2ChainId.Mainnet', () => {
      const result = getNetworkNameFromScope(Caip2ChainId.Mainnet);
      expect(result).toBe(Caip2ChainIdToNetworkName[Caip2ChainId.Mainnet]);
    });

    it('should return "Testnet" for Caip2ChainId.Testnet', () => {
      const result = getNetworkNameFromScope(Caip2ChainId.Testnet);
      expect(result).toBe(Caip2ChainIdToNetworkName[Caip2ChainId.Testnet]);
    });

    it('should return "Unknown" for an unknown scope', () => {
      const result = getNetworkNameFromScope('unknownScope' as Caip2ChainId);
      expect(result).toBe(expectedError);
    });

    it('should return "Unknown" for an empty string', () => {
      const result = getNetworkNameFromScope('' as Caip2ChainId);
      expect(result).toBe(expectedError);
    });

    it('should return "Unknown" for null', () => {
      const result = getNetworkNameFromScope(null as unknown as Caip2ChainId);
      expect(result).toBe(expectedError);
    });

    it('should return "Unknown" for undefined', () => {
      const result = getNetworkNameFromScope(
        undefined as unknown as Caip2ChainId,
      );
      expect(result).toBe(expectedError);
    });
  });
});
