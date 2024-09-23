import { is } from '@metamask/superstruct';
import { v4 as uuidV4 } from 'uuid';
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

export type GenerateSendFlowParams = {
  account: KeyringAccount;
  fees: Currency;
  scope: string;
  balance: Currency;
};

export type UpdateSendFlowParams = {
  interfaceId: string;
  account: KeyringAccount;
  fees: Currency;
  scope: string;
  balance: Currency;
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
  interfaceId,
  fees,
  account,
}: UpdateSendFlowParams) {
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id: interfaceId,
      ui: (
        <SendFlow
          account={account}
          selectedCurrency="BTC"
          total={{ amount: '0', fiat: 0 }}
          fees={fees}
          displayClearIcon={false}
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

  if (
    (context.scope === Caip2ChainId.Mainnet &&
      validate(formState.to, Network.mainnet)) ||
    (context.scope === Caip2ChainId.Testnet &&
      validate(formState.to, Network.testnet))
  ) {
    errors.to = 'Invalid address';
  }

  if (
    formState.amount &&
    Number(formState.amount) >
      Number(context.accounts[formState.accountSelector].balance.amount)
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

export function containsCompleteSendManyRequest(
  request: SendManyParams,
): request is SendManyParams {
  return is(request, SendManyParamsStruct);
}
