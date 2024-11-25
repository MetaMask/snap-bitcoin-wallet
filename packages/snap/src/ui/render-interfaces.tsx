import { v4 as uuidv4 } from 'uuid';

import type { SendFlowRequest } from '../stateManagement';
import {
  generateDefaultSendFlowParams,
  generateDefaultSendFlowRequest,
} from '../utils/transaction';
import { SendFlow, ReviewTransaction } from './components';
import type { GenerateSendFlowParams, UpdateSendFlowParams } from './types';

/**
 * Generate the send flow.
 *
 * @param params - The parameters for the send form.
 * @param params.account - The selected account.
 * @param params.scope - The scope of the send flow.
 * @param params.locale - The locale of the user.
 * @returns The interface ID.
 */
export async function generateSendFlow({
  account,
  scope,
  locale,
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
          locale={locale}
        />
      ),
      context: {
        requestId,
        accounts: [account],
        scope,
        locale,
      },
    },
  });

  const sendFlowRequest = generateDefaultSendFlowRequest(
    locale,
    account,
    scope,
    requestId,
    interfaceId,
  );

  return sendFlowRequest;
}

/**
 * Update the send flow interface.
 *
 * @param options - The options for updating the send flow.
 * @param options.locale - The locale of the user.
 * @param options.request - The send flow request object.
 * @param options.flushToAddress - Whether to flush to address.
 * @param options.currencySwitched - Whether the currency was switched.
 * @param options.backEventTriggered - Whether the back event was triggered.
 */
export async function updateSendFlow({
  locale,
  request,
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
          locale={locale}
          account={request.account}
          sendFlowParams={request}
          flushToAddress={flushToAddress}
          currencySwitched={currencySwitched}
          backEventTriggered={backEventTriggered}
        />
      ),
    },
  });
}

/**
 * Generate the confirmation review interface.
 *
 * @param options0 - The options for generating the confirmation review interface.
 * @param options0.request - The send flow request object.
 * @returns The interface ID as a string.
 */
export async function generateConfirmationReviewInterface({
  request,
}: {
  request: SendFlowRequest;
}): Promise<string> {
  return await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: <ReviewTransaction {...request} txSpeed="30m" />,
    },
  });
}

/**
 * Display the confirmation review interface.
 *
 * @param options0 - The options for displaying the confirmation review interface.
 * @param options0.request - The send flow request object.
 * @returns A promise that resolves when the confirmation review interface is displayed.
 */
export async function displayConfirmationReview({
  request,
}: {
  request: SendFlowRequest;
}) {
  return await snap.request({
    method: 'snap_updateInterface',
    params: {
      id: request.interfaceId,
      ui: <ReviewTransaction {...request} txSpeed="30m" />,
    },
  });
}
