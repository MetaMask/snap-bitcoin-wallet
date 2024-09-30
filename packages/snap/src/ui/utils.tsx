import type { KeyringAccount } from '@metamask/keyring-api';
import { is } from '@metamask/superstruct';
import { BigNumber } from 'bignumber.js';
import validate, { Network } from 'bitcoin-address-validation';
import { v4 as uuidv4 } from 'uuid';

import { Caip2ChainId } from '../constants';
import type { SendManyParams } from '../rpcs';
import { SendManyParamsStruct } from '../rpcs';
import {
  generateDefaultSendFlowParams,
  generateDefaultSendFlowRequest,
  type SendFlowRequest,
} from '../stateManagement';
import { SendFlow } from './components';
import type {
  Currency,
  SendFlowContext,
  SendFormErrors,
  SendFormState,
} from './types';

export type AccountWithBalance = KeyringAccount & { balance?: Currency };

export enum AssetType {
  BTC = 'BTC',
  FIAT = '$',
}

export type GenerateSendFlowParams = {
  account: KeyringAccount;
  scope: string;
};

export type UpdateSendFlowParams = {
  request: SendFlowRequest;
  displayClearIcon: boolean;
  flushToAddress?: boolean;
  currencySwitched?: boolean;
  backEventTriggered?: boolean;
};

/**
 * Generate the send flow.
 *
 * @param params - The parameters for the send form.
 * @param params.account - The selected account.
 * @param params.scope
 * @returns The interface ID.
 */
export async function generateSendFlow({
  account,
  scope,
}: GenerateSendFlowParams): Promise<SendFlowRequest> {
  const requestId = uuidv4();
  const sendFlowProps = generateDefaultSendFlowParams();
  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: (
        <SendFlow
          account={account}
          sendFlowParams={{
            ...sendFlowProps,
          }}
          displayClearIcon={false}
        />
      ),
      context: {
        requestId,
        accounts: [account],
        scope,
      },
    },
  });

  const sendFlowRequest = generateDefaultSendFlowRequest(
    account,
    scope,
    requestId,
    interfaceId,
  );

  return sendFlowRequest;
}

/**
 *
 * @param options0
 * @param options0.isLoading
 * @param options0.interfaceId
 * @param options0.account
 * @param options0.selectedCurrency
 * @param options0.total
 * @param options0.fees
 * @param options0.balance
 * @param options0.amount
 */
export async function updateSendFlow({
  request,
  displayClearIcon,
  flushToAddress = false,
  currencySwitched = false,
  backEventTriggered = false,
}: UpdateSendFlowParams) {
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id: request.interfaceId,
      ui: (
        <SendFlow
          account={request.account}
          sendFlowParams={request}
          flushToAddress={flushToAddress}
          displayClearIcon={displayClearIcon}
          currencySwitched={currencySwitched}
          backEventTriggered={backEventTriggered}
        />
      ),
    },
  });
}

/**
 * Validate the send form.
 *
 * @param formState - The state of the send form.
 * @param context - The context of the interface.
 * @param balance
 * @param selectedCurrency
 * @param rates
 * @returns The form errors.
 */
export function formValidation(
  formState: SendFormState,
  context: SendFlowContext,
  request: SendFlowRequest,
): SendFlowRequest {
  const errors: SendFormErrors = {
    to: '',
    amount: '',
    total: '',
    fees: '',
  };

  console.log('formState', JSON.stringify(formState, null, 4));

  const cryptoAmount =
    request.selectedCurrency === AssetType.BTC
      ? formState.amount ?? '0'
      : convertFiatToBtc(formState.amount ?? '0', request.rates);

  if (
    formState.to &&
    ((context.scope === Caip2ChainId.Mainnet &&
      !validate(formState.to, Network.mainnet)) ||
      (context.scope === Caip2ChainId.Testnet &&
        !validate(formState.to, Network.testnet)))
  ) {
    errors.to = 'Invalid address';
    request.recipient = {
      address: formState.to,
      error: errors.to,
      valid: Boolean(!errors.to),
    };
  }

  if (formState.amount && isNaN(Number(formState.amount))) {
    errors.amount = 'Invalid amount';
    request.amount = {
      amount: '',
      fiat: '',
      error: errors.amount,
      valid: Boolean(!errors.amount),
    };
  }

  if (
    formState.amount &&
    new BigNumber(formState.amount).lte(new BigNumber(0))
  ) {
    errors.amount = 'Amount must be greater than 0';
    request.amount = {
      amount: '0',
      fiat: '0',
      error: errors.amount,
      valid: Boolean(!errors.amount),
    };
  }

  if (
    formState.amount &&
    new BigNumber(cryptoAmount).gt(new BigNumber(this.request.balance.amount))
  ) {
    errors.amount = 'Insufficient funds';
    request.amount = {
      amount: formState.amount,
      fiat: convertBtcToFiat(formState.amount, this.request.rates),
      error: errors.amount,
      valid: Boolean(!errors.amount),
    };
  }

  return request;
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
 *
 * @param request
 */
export function containsCompleteSendManyRequest(
  request: SendManyParams,
): request is SendManyParams {
  return is(request, SendManyParamsStruct);
}

/**
 *
 * @param interfaceId
 * @param scope
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
 *
 * @param amount
 * @param rate
 */
export function convertBtcToFiat(amount: string, rate: string): string {
  const amountBN = new BigNumber(amount);
  const rateBN = new BigNumber(rate);
  return amountBN.multipliedBy(rateBN).toFixed(2);
}

/**
 *
 * @param amount
 * @param rate
 */
export function convertFiatToBtc(amount: string, rate: string): string {
  const amountBN = new BigNumber(amount);
  const rateBN = new BigNumber(rate);
  return amountBN.dividedBy(rateBN).toFixed(8); // 8 is the number of decimals for btc
}
