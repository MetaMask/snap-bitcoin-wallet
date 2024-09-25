import type { KeyringAccount } from '@metamask/keyring-api';
import { is } from '@metamask/superstruct';
import { BigNumber } from 'bignumber.js';
import validate, { Network } from 'bitcoin-address-validation';
import { v4 as uuidV4 } from 'uuid';

import { Caip2ChainId } from '../constants';
import type { SendManyParams } from '../rpcs';
import { defaultSendManyParams, SendManyParamsStruct } from '../rpcs';
import type { SendFlowRequest } from '../stateManagement';
import { logger } from '../utils';
import { SendFlow } from './components';
import type {
  Currency,
  SendFlowContext,
  SendFormErrors,
  SendFormState,
} from './types';

export type AccountWithBalance = KeyringAccount & { balance?: Currency };

export type GenerateSendFlowParams = {
  account: KeyringAccount;
  fees: Currency;
  scope: string;
};

export type UpdateSendFlowParams = {
  interfaceId: string;
  selectedCurrency: 'BTC' | '$';
  account: KeyringAccount;
  scope: string;
  fees: Currency;
  balance: Currency;
  amount: string;
  rates: string;
  isLoading: boolean;
};

/**
 * Generate the send flow.
 *
 * @param params - The parameters for the send form.
 * @param params.account - The selected account.
 * @param params.fees - The fees for the transaction.
 * @param params.scope
 * @returns The interface ID.
 */
export async function generateSendFlow({
  account,
  fees,
  scope,
}: GenerateSendFlowParams): Promise<SendFlowRequest> {
  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: (
        <SendFlow
          account={account}
          selectedCurrency="BTC"
          fees={fees}
          displayClearIcon={false}
          isLoading={true}
          balance={{ amount: '', fiat: '' }}
          amount=""
        />
      ),
      context: {
        accounts: [account],
        selectedCurrency: 'BTC',
        fees,
        scope,
      },
    },
  });

  const sendFlowRequest: SendFlowRequest = {
    id: interfaceId, // we use the same id for the interface and the request
    account: account.id,
    scope,
    transaction: defaultSendManyParams(scope),
    status: 'draft',
    interfaceId,
    selectedCurrency: 'BTC',
    rates: '',
    balance: {
      amount: '',
      fiat: '',
    },
    fees: {
      amount: '0',
      fiat: '0',
    },
  };

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
  isLoading,
  interfaceId,
  account,
  selectedCurrency,
  fees,
  balance,
  amount,
}: UpdateSendFlowParams) {
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id: interfaceId,
      ui: (
        <SendFlow
          account={account}
          selectedCurrency={selectedCurrency}
          displayClearIcon={false}
          isLoading={isLoading}
          balance={balance}
          amount={amount}
          fees={isLoading ? { amount: '', fiat: '' } : fees}
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
  balance: Currency,
  selectedCurrency: 'BTC' | '$',
  rates: string,
): SendFormErrors {
  const errors: Partial<SendFormErrors> = {};
  const cryptoAmount =
    selectedCurrency === 'BTC'
      ? formState.amount
      : convertFiatToBtc(formState.amount, rates);

  logger.log('starting validation');
  if (
    formState.to &&
    ((context.scope === Caip2ChainId.Mainnet &&
      !validate(formState.to, Network.mainnet)) ||
      (context.scope === Caip2ChainId.Testnet &&
        !validate(formState.to, Network.testnet)))
  ) {
    errors.to = 'Invalid address';
  }

  if (formState.amount && isNaN(Number(formState.amount))) {
    errors.amount = 'Invalid amount';
  }

  if (new BigNumber(formState.amount).lte(new BigNumber(0))) {
    errors.amount = 'Amount must be greater than 0';
  }

  // TODO: get rates
  if (
    formState.amount &&
    new BigNumber(cryptoAmount).gt(new BigNumber(balance.amount))
  ) {
    errors.amount = 'Insufficient funds';
  }

  return errors;
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
  interfaceId: string,
  scope: string,
): Promise<SendManyParams> {
  const acceptedSendFlowState = (
    await snap.request({
      method: 'snap_getInterfaceState',
      params: { id: interfaceId },
    })
  ).sendForm as SendFormState;

  return {
    amounts: {
      [acceptedSendFlowState.to]: acceptedSendFlowState.amount,
    },
    comment: '',
    subtractFeeFrom: [],
    replaceable: true,
    dryrun: true, // TODO: change to false
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
  return amountBN.dividedBy(rateBN).toFixed(8);
}
