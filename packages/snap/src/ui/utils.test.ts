import { expect } from '@jest/globals';
import { BtcAccountType } from '@metamask/keyring-api';
import { BigNumber } from 'bignumber.js';
import { v4 as uuidv4 } from 'uuid';

import { Caip2ChainId } from '../constants';
import type { SendManyParams } from '../rpcs';
import { generateDefaultSendFlowRequest } from '../stateManagement';
import { AssetType } from './types';
import {
  truncate,
  validateAmount,
  validateRecipient,
  convertBtcToFiat,
  convertFiatToBtc,
  sendStateToSendManyParams,
  sendManyParamsToSendFlowParams,
  formValidation,
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
  methods: ['btc_sendmany'],
};

describe('utils', () => {
  describe('truncate', () => {
    it('should truncate a string longer than the specified length', () => {
      expect(truncate('1234567890', 5)).toBe('12345...67890');
    });

    it('should return the original string if its length is less than or equal to the specified length', () => {
      expect(truncate('12345', 5)).toBe('12345');
      expect(truncate('1234', 5)).toBe('1234');
    });

    it('should handle empty strings', () => {
      expect(truncate('', 5)).toBe('');
    });

    it('should handle strings with length exactly equal to the specified length', () => {
      expect(truncate('12345', 5)).toBe('12345');
    });

    it('should handle strings with length just one more than the specified length', () => {
      expect(truncate('123456', 5)).toBe('12345...23456');
    });

    it('should handle strings with length just one less than the specified length', () => {
      expect(truncate('1234', 5)).toBe('1234');
    });

    it('should handle negative length values gracefully', () => {
      expect(truncate('1234567890', -1)).toBe('12345...67890');
    });

    it('should handle zero length value gracefully', () => {
      expect(truncate('1234567890', 0)).toBe('12345...67890');
    });
  });

  describe('validateAmount', () => {
    it('should return error if amount is not a number', () => {
      const result = validateAmount('abc', '100', '62000');
      expect(result).toStrictEqual({
        amount: '',
        fiat: '',
        error: 'Invalid amount',
        valid: false,
      });
    });

    it('should return error if amount is less than or equal to 0', () => {
      const result = validateAmount('0', '100', '62000');
      expect(result).toStrictEqual({
        amount: '0',
        fiat: '0',
        error: 'Amount must be greater than 0',
        valid: false,
      });
    });

    it('should return error if amount is greater than balance', () => {
      const result = validateAmount('200', '100', '62000');
      expect(result).toStrictEqual({
        amount: '200',
        fiat: '12400000.00',
        error: 'Insufficient funds',
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
        error: 'Invalid address',
        valid: false,
      });
    });

    it('should return error for an invalid testnet address', () => {
      const result = validateRecipient('invalidAddress', Caip2ChainId.Testnet);
      expect(result).toStrictEqual({
        address: 'invalidAddress',
        error: 'Invalid address',
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
        error: 'Invalid address',
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
        error: 'Invalid address',
        valid: false,
      });
    });

    it('should handle empty address', () => {
      const result = validateRecipient('', Caip2ChainId.Mainnet);
      expect(result).toStrictEqual({
        address: '',
        error: 'Invalid address',
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
        error: 'Invalid address',
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
        error: 'Invalid address',
        valid: false,
      });
    });
  });

  describe('sendStateToSendManyParams', () => {
    it('should convert send state to SendManyParams correctly', async () => {
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

      const result = await sendStateToSendManyParams(request, scope);

      expect(result).toStrictEqual({
        amounts: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '0.1' },
        comment: '',
        subtractFeeFrom: [],
        replaceable: true,
        dryrun: false,
        scope,
      });
    });
  });

  describe('sendManyParamsToSendFlowParams', () => {
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

    it('should convert SendManyParams to SendFlowParams correctly', async () => {
      const params: Omit<SendManyParams, 'scope'> = {
        amounts: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '0.1' },
        comment: '',
        subtractFeeFrom: [],
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = await sendManyParamsToSendFlowParams(
        params,
        account,
        scope,
        rates,
        balance,
      );

      const expectedAmount = Object.values(params.amounts)[0];
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
          fiat: convertBtcToFiat(balance, rates),
        },
        fees: {
          amount: mockFee.fee.amount,
          fiat: convertBtcToFiat(mockFee.fee.amount, rates),
          loading: false,
          error: '',
        },
        amount: {
          amount: expectedAmount,
          fiat: convertBtcToFiat(expectedAmount, rates),
          error: '',
          valid: true,
        },
        total: {
          amount: expectedTotal,
          fiat: convertBtcToFiat(expectedTotal, rates),
        },
        selectedCurrency: AssetType.BTC,
      });
    });

    it('should handle invalid recipient address', async () => {
      const params = {
        amounts: { invalidAddress: '0.1' },
        comment: '',
        subtractFeeFrom: [],
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = await sendManyParamsToSendFlowParams(
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
        amounts: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '0' },
        comment: '',
        subtractFeeFrom: [],
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = await sendManyParamsToSendFlowParams(
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
        amounts: { bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a: '2' },
        comment: '',
        subtractFeeFrom: [],
        replaceable: true,
        dryrun: false,
      };
      const account = 'testAccount';
      const scope = Caip2ChainId.Mainnet;
      const rates = '62000';
      const balance = '1';

      const result = sendManyParamsToSendFlowParams(
        params,
        account,
        scope,
        rates,
        balance,
      );
      expect((await result).amount.error).toBe('Insufficient funds');
    });
  });

  describe('convertBtcToFiat', () => {
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
        expect(convertBtcToFiat(amount, rate)).toStrictEqual(expected);
      },
    );
  });

  describe('convertFiatToBtc', () => {
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
        expect(convertFiatToBtc(amount, rate)).toStrictEqual(expected);
      },
    );
  });

  describe('formValidation', () => {
    const context = { scope: Caip2ChainId.Mainnet };
    const rates = '62000';
    const balance = '1';

    it('should validate form correctly with valid data', () => {
      const formState = {
        amount: '0.1',
        to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
      };
      const request = {
        total: { amount: '', fiat: '' },
        recipient: { address: '', error: '', valid: false },
        amount: { amount: '', fiat: '', error: '', valid: false },
        fees: { amount: '', fiat: '', loading: false, error: '' },
        selectedCurrency: AssetType.BTC,
        rates,
        balance: { amount: balance, fiat: '62000.00' },
      };
      // @ts-expect-error test only request params and not the whole object
      const result = formValidation(formState, context, request);

      expect(result).toStrictEqual({
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
        total: {
          amount: '',
          fiat: '',
        },
      });
    });

    it.each([
      {
        formState: {
          amount: 'abc',
          to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        },
        expectedAmountError: 'Invalid amount',
        expectedRecipientError: '',
      },
      {
        formState: {
          amount: '0',
          to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        },
        expectedAmountError: 'Amount must be greater than 0',
        expectedRecipientError: '',
      },
      {
        formState: {
          amount: '2',
          to: 'bc1q26a367uz34eg5mufwhlscwdcplu6frtgf00r7a',
        },
        expectedAmountError: 'Insufficient funds',
        expectedRecipientError: '',
      },
      {
        formState: { amount: '0.1', to: 'invalidAddress' },
        expectedAmountError: '',
        expectedRecipientError: 'Invalid address',
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
});
