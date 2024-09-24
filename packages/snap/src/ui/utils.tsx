import { v4 as uuidV4 } from 'uuid';
import { is } from '@metamask/superstruct';
import {
  defaultSendManyParams,
  SendManyParams,
  SendManyParamsStruct,
} from '../rpcs';
import { SendFlow } from './components';
import type {
  Currency,
  SendFlowContext,
  SendFormErrors,
  SendFormState,
} from './types';
import { SendFlowRequest } from '../stateManagement';
import { KeyringAccount } from '@metamask/keyring-api';
import { Caip2ChainId } from '../constants';
import validate, { Network } from 'bitcoin-address-validation';
import { logger } from '../utils';

export type AccountWithBalance = KeyringAccount & { balance?: Currency };

export type GenerateSendFlowParams = {
  account: AccountWithBalance;
  fees: Currency;
  scope: string;
};

export type UpdateSendFlowParams = {
  interfaceId: string;
  selectedCurrency: 'BTC' | '$';
  account: AccountWithBalance;
  fees: Currency;
  scope: string;
  total: Currency;
  isLoading: boolean;
};

/**
 * Generate the send flow.
 *
 * @param params - The parameters for the send form.
 * @param params.account - The selected account.
 * @param params.fees - The fees for the transaction.
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
          total={{ amount: '0', fiat: 0 }}
          fees={fees}
          displayClearIcon={false}
          isLoading={true}
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
    id: uuidV4(),
    account: account.id,
    scope: scope,
    transaction: defaultSendManyParams(scope),
    status: 'draft',
    interfaceId,
  };

  return sendFlowRequest;
}

export async function updateSendFlow({
  isLoading,
  interfaceId,
  account,
  selectedCurrency,
  total,
  fees,
}: UpdateSendFlowParams) {
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id: interfaceId,
      ui: (
        <SendFlow
          account={account}
          selectedCurrency={selectedCurrency}
          total={isLoading ? { amount: '0', fiat: 0 } : total}
          fees={isLoading ? { amount: '0', fiat: 0 } : fees}
          displayClearIcon={false}
          isLoading={isLoading}
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
 * @returns The form errors.
 */
export function formValidation(
  formState: SendFormState,
  context: SendFlowContext,
): SendFormErrors {
  const errors: Partial<SendFormErrors> = {};

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

  if (Number(formState.amount) <= 0) {
    errors.amount = 'Amount must be greater than 0';
  }

  // TODO: get rates
  // if (
  //   formState.amount &&
  //   Number(formState.amount) >
  //     Number(context.accounts[formState.accountSelector].balance.amount)
  // ) {
  //   errors.amount = 'Insufficient funds';
  // }

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

export function containsCompleteSendManyRequest(
  request: SendManyParams,
): request is SendManyParams {
  return is(request, SendManyParamsStruct);
}

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
    dryrun: true, // TODO: change to true
    scope,
  };
}
