import { is } from '@metamask/superstruct';
import { BigNumber } from 'bignumber.js';
// eslint-disable-next-line import/no-named-as-default
import validate, { Network } from 'bitcoin-address-validation';

import { Caip2ChainId } from '../constants';
import type { SendManyParams } from '../rpcs';
import { estimateFee, SendManyStruct } from '../rpcs';
import type { SendFlowParams } from '../stateManagement';
import {
  generateDefaultSendFlowParams,
  type SendFlowRequest,
} from '../stateManagement';
import { AssetType } from './types';
import type { SendFlowContext, SendFormState } from './types';

/**
 * Validate the send form.
 *
 * @param formState - The state of the send form.
 * @param context - The context of the interface.
 * @param request - The request object containing form data and errors.
 * @returns The form errors.
 */
export function formValidation(
  formState: SendFormState,
  context: SendFlowContext,
  request: SendFlowRequest,
): SendFlowRequest {
  // reset errors
  request.amount.error = '';
  request.recipient.error = '';
  request.fees.error = '';

  const cryptoAmount =
    request.selectedCurrency === AssetType.BTC
      ? formState.amount ?? '0'
      : convertFiatToBtc(formState.amount ?? '0', request.rates);

  request.recipient = validateRecipient(formState.to, context.scope);
  request.amount = validateAmount(
    cryptoAmount,
    request.balance.amount,
    request.rates,
  );

  // Reset the fees if the amount is invalid
  if (request.amount.error) {
    request.fees = {
      amount: '',
      fiat: '',
      loading: false,
      error: '',
    };
  }

  return request;
}

/**
 * Validates the amount to be sent.
 *
 * @param amount - The amount to be validated.
 * @param balance - The current balance of the account.
 * @param rates - The conversion rates from Bitcoin to fiat.
 * @returns An object containing the validated amount, fiat equivalent, error message, and validity status.
 */
export function validateAmount(
  amount: string,
  balance: string,
  rates: string,
): SendFlowRequest['amount'] {
  if (amount && isNaN(Number(amount))) {
    return {
      amount: '',
      fiat: '',
      error: 'Invalid amount',
      valid: false,
    };
  }

  if (amount && new BigNumber(amount).lte(new BigNumber(0))) {
    return {
      amount: '0',
      fiat: '0',
      error: 'Amount must be greater than 0',
      valid: false,
    };
  }

  if (amount && new BigNumber(amount).gt(new BigNumber(balance))) {
    return {
      amount,
      fiat: convertBtcToFiat(amount, rates),
      error: 'Insufficient funds',
      valid: false,
    };
  }

  return {
    amount,
    fiat: convertBtcToFiat(amount, rates),
    error: '',
    valid: true,
  };
}

/**
 * Truncate a string to a given length.
 *
 * @param str - The string to truncate.
 * @param length - The number of characters to truncate the string to.
 * @returns The truncated string.
 */
export function truncate(str: string, length: number): string {
  return str.length > length
    ? `${str.slice(0, 5)}...${str.slice(str.length - 5, str.length)}`
    : str;
}

/**
 * Checks if the request contains a complete SendManyParams object.
 *
 * @param request - The request object to check.
 * @returns True if the request contains a complete SendManyParams object, false otherwise.
 */
export function containsCompleteSendManyRequest(
  request: Omit<SendManyParams, 'scope'>,
): request is Omit<SendManyParams, 'scope'> {
  return is(request, SendManyStruct);
}

/**
 * Converts the send state to SendManyParams.
 *
 * @param request - The request object containing form data and errors.
 * @param scope - The scope of the network (mainnet or testnet).
 * @returns A promise that resolves to the SendManyParams object.
 */
export async function sendStateToSendManyParams(
  request: SendFlowRequest,
  scope: string,
): Promise<SendManyParams> {
  return {
    amounts: {
      [request.recipient.address]: request.amount.amount,
    },
    comment: '',
    subtractFeeFrom: [],
    replaceable: true,
    dryrun: false,
    scope,
  };
}

/**
 * Converts a Bitcoin amount to its equivalent fiat value.
 *
 * @param amount - The amount of Bitcoin to convert.
 * @param rate - The conversion rate from Bitcoin to fiat.
 * @returns The equivalent fiat value as a string.
 */
export function convertBtcToFiat(amount: string, rate: string): string {
  const amountBN = new BigNumber(amount);
  const rateBN = new BigNumber(rate);
  return amountBN.multipliedBy(rateBN).toFixed(2);
}

/**
 * Converts a fiat amount to its equivalent Bitcoin value.
 *
 * @param amount - The amount of fiat currency to convert.
 * @param rate - The conversion rate from fiat to Bitcoin.
 * @returns The equivalent Bitcoin value as a string.
 */
export function convertFiatToBtc(amount: string, rate: string): string {
  const amountBN = new BigNumber(amount);
  const rateBN = new BigNumber(rate);
  return amountBN.dividedBy(rateBN).toFixed(8); // 8 is the number of decimals for btc
}

/**
 * Validates the recipient address based on the given scope.
 *
 * @param address - The recipient address to validate.
 * @param scope - The scope of the network (mainnet or testnet).
 * @returns An object containing the address, error message, and validity status.
 */
export function validateRecipient(
  address: string,
  scope: string,
): SendFlowRequest['recipient'] {
  if (
    (scope === Caip2ChainId.Mainnet && !validate(address, Network.mainnet)) ||
    (scope === Caip2ChainId.Testnet && !validate(address, Network.testnet))
  ) {
    return {
      address: address ?? '',
      error: 'Invalid address',
      valid: false,
    };
  }

  return {
    address,
    error: '',
    valid: true,
  };
}

/**
 * Converts SendManyParams to SendFlowParams.
 *
 * @param params - The parameters for sending many transactions.
 * @param account - The account from which the transactions will be sent.
 * @param scope - The scope of the network (mainnet or testnet).
 * @param rates - The conversion rates from Bitcoin to fiat.
 * @param balance - The balance of the account.
 * @returns A promise that resolves to the send flow parameters.
 */
export async function sendManyParamsToSendFlowParams(
  params: Omit<SendManyParams, 'scope'>,
  account: string,
  scope: string,
  rates: string,
  balance: string,
): Promise<SendFlowParams> {
  const defaultParams = generateDefaultSendFlowParams();
  const recipient = Object.keys(params.amounts)[0];
  const amount = params.amounts[recipient];

  defaultParams.rates = rates;
  defaultParams.recipient = validateRecipient(recipient, scope);
  defaultParams.balance = {
    amount: balance,
    fiat: convertBtcToFiat(balance, rates),
  };

  try {
    const estimatedFees = await estimateFee({
      account,
      amount,
    });
    defaultParams.fees.amount = estimatedFees.fee.amount;
    defaultParams.fees.fiat = convertBtcToFiat(estimatedFees.fee.amount, rates);
    defaultParams.amount = validateAmount(amount, balance, rates);
    defaultParams.total = {
      amount: new BigNumber(amount)
        .plus(new BigNumber(defaultParams.fees.amount ?? '0'))
        .toString(),
      fiat: convertBtcToFiat(
        new BigNumber(amount)
          .plus(new BigNumber(defaultParams.fees.amount ?? '0'))
          .toString(),
        rates,
      ),
    };
  } catch (error) {
    console.log('error estimating fees', error);
    defaultParams.fees.error = `Error estimating fees: ${error as string}`;
  }

  return defaultParams;
}
