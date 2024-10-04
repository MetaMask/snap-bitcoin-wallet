import { v4 as uuidv4 } from 'uuid';

import type { SendFlowRequest } from '../stateManagement';
import {
  generateDefaultSendFlowParams,
  generateDefaultSendFlowRequest,
} from '../stateManagement';
import { SendFlow, ReviewTransaction } from './components';
import type { GenerateSendFlowParams, UpdateSendFlowParams } from './types';

/**
 * Generate the send flow.
 *
 * @param params - The parameters for the send form.
 * @param params.account - The selected account.
 * @param params.scope - The scope of the send flow.
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
 * Update the send flow interface.
 *
 * @param options - The options for updating the send flow.
 * @param options.request - The send flow request object.
 * @param options.displayClearIcon - Whether to display the clear icon.
 * @param options.flushToAddress - Whether to flush to address.
 * @param options.currencySwitched - Whether the currency was switched.
 * @param options.backEventTriggered - Whether the back event was triggered.
 * @param options.showReviewTransaction - Whether to show the review transaction.
 */
export async function updateSendFlow({
  request,
  displayClearIcon,
  flushToAddress = false,
  currencySwitched = false,
  backEventTriggered = false,
  showReviewTransaction = false,
}: UpdateSendFlowParams) {
  await snap.request({
    method: 'snap_updateInterface',
    params: {
      id: request.interfaceId,
      ui: showReviewTransaction ? (
        <ReviewTransaction {...request} txSpeed="30m" />
      ) : (
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
