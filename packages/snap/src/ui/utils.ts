import { BigNumber } from 'bignumber.js';
// eslint-disable-next-line import/no-named-as-default
import validate, { Network } from 'bitcoin-address-validation';
import { v4 as uuidv4 } from 'uuid';

import {
  Caip2Asset,
  Caip2ChainId,
  Caip2ChainIdToNetworkName,
} from '../constants';
import type { SendManyParams } from '../rpcs';
import { estimateFee } from '../rpcs';
import type { SendFlowParams, Wallet } from '../stateManagement';
import { TransactionStatus, type SendFlowRequest } from '../stateManagement';
import { generateDefaultSendFlowParams } from '../utils/transaction';
import { generateConfirmationReviewInterface } from './render-interfaces';
import { AssetType, SendFormError } from './types';
import type { SendFlowContext, SendFormState } from './types';

/**
 * Validate the send form.
 *
 * @param formState - The state of the send form.
 * @param context - The context of the interface.
 * @param request - The request object containing form data and errors.
 * @returns The `SendFlowRequest` object with the assigned errors.
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

  const formAmount = formState.amount ?? '0';
  const cryptoAmount =
    request.selectedCurrency === AssetType.BTC
      ? formAmount
      : fiatToBtc(formAmount, request.rates);

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
      error: SendFormError.InvalidAmount,
      valid: false,
    };
  }

  if (amount && new BigNumber(amount).lte(new BigNumber(0))) {
    return {
      amount: '0',
      fiat: '0',
      error: SendFormError.ZeroAmount,
      valid: false,
    };
  }

  if (amount && new BigNumber(amount).gt(new BigNumber(balance))) {
    return {
      amount,
      fiat: btcToFiat(amount, rates),
      error: SendFormError.InsufficientFunds,
      valid: false,
    };
  }

  return {
    amount,
    fiat: btcToFiat(amount, rates),
    error: '',
    valid: true,
  };
}

/**
 * Validates the amount to be sent.
 *
 * @param amount - The amount to be validated.
 * @param fees - The fees to be validated.
 * @param balance - The current balance of the account.
 * @param rates - The conversion rates from Bitcoin to fiat.
 * @returns An object containing the validated amount, fiat equivalent, error message, and validity status.
 */
export function validateTotal(
  amount: string,
  fees: string,
  balance: string,
  rates: string,
): SendFlowRequest['total'] {
  if ([amount, fees, balance, rates].some((value) => isNaN(Number(value)))) {
    return {
      amount: '',
      fiat: '',
      error: '',
      valid: false,
    };
  }

  const total = new BigNumber(amount).plus(new BigNumber(fees));
  if (total.gt(new BigNumber(balance))) {
    return {
      amount,
      fiat: btcToFiat(amount, rates),
      error: SendFormError.TotalExceedsBalance,
      valid: false,
    };
  }

  const newTotal = total.toString();
  return {
    amount: newTotal,
    fiat: btcToFiat(newTotal, rates),
    error: '',
    valid: true,
  };
}

/**
 * Converts the send state to SendManyParams.
 *
 * @param scope - The scope of the network (mainnet or testnet).
 * @param request - The request object containing form data and errors.
 * @returns A promise that resolves to the SendManyParams object.
 */
export function generateSendManyParams(
  scope: string,
  request?: SendFlowRequest,
): SendManyParams {
  if (!request) {
    return {
      amounts: {},
      comment: '',
      subtractFeeFrom: [],
      replaceable: true,
      dryrun: false,
      scope,
    };
  }

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
export function btcToFiat(amount: string, rate: string): string {
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
export function fiatToBtc(amount: string, rate: string): string {
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
      error: SendFormError.InvalidAddress,
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
 * Generates a send flow request object.
 *
 * @param wallet - The wallet object containing account and scope information.
 * @param status - The current transaction status.
 * @param rates - The conversion rates from Bitcoin to fiat.
 * @param balance - The current balance of the account.
 * @param transaction - Optional transaction details.
 * @returns A promise that resolves to the SendFlowRequest object.
 */
export async function generateSendFlowRequest(
  wallet: Wallet,
  status: TransactionStatus,
  rates: string,
  balance: string,
  transaction?: SendFlowRequest['transaction'],
): Promise<SendFlowRequest> {
  const sendManyParams = transaction ?? generateSendManyParams(wallet.scope);
  const sendFlowRequest = {
    id: uuidv4(),
    account: wallet.account,
    scope: wallet.scope,
    transaction: sendManyParams,
    interfaceId: '',
    status: status ?? TransactionStatus.Draft,
    ...(await sendManyParamsToSendFlowParams(
      sendManyParams,
      wallet.account.id,
      wallet.scope,
      rates,
      balance,
    )),
  };

  const interfaceId = await generateConfirmationReviewInterface({
    request: sendFlowRequest,
  });

  sendFlowRequest.interfaceId = interfaceId;

  return sendFlowRequest;
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
  // This is safe because we validate the recipient in `validateRecipient` if it is not defined.
  const recipient = Object.keys(params.amounts)[0];
  const amount = params.amounts[recipient];

  defaultParams.rates = rates;
  defaultParams.recipient = validateRecipient(recipient, scope);
  defaultParams.balance = {
    amount: balance,
    fiat: btcToFiat(balance, rates),
  };

  try {
    const estimatedFees = await estimateFee({
      account,
      amount,
    });
    defaultParams.fees.amount = estimatedFees.fee.amount;
    defaultParams.fees.fiat = btcToFiat(estimatedFees.fee.amount, rates);
    defaultParams.amount = validateAmount(amount, balance, rates);
    defaultParams.total = validateTotal(
      amount,
      estimatedFees.fee.amount,
      balance,
      rates,
    );
  } catch (error) {
    defaultParams.fees.error = `Error estimating fees: ${
      error.message as string
    }`;
  }

  return defaultParams;
}

/**
 * Gets the asset type based on the given scope.
 *
 * @param scope - The scope of the network (mainnet or testnet).
 * @returns The asset type corresponding to the scope.
 */
export function getAssetTypeFromScope(scope: string): Caip2Asset {
  return scope === Caip2ChainId.Mainnet ? Caip2Asset.Btc : Caip2Asset.TBtc;
}

/**
 * Gets the network name based on the given scope.
 *
 * @param scope - The scope of the network (mainnet or testnet).
 * @returns The network name corresponding to the scope.
 */
export function getNetworkNameFromScope(scope: string): string {
  return Caip2ChainIdToNetworkName[scope] ?? 'Unknown Network';
}
