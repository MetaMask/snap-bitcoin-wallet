import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import type { ButtonClickEvent, InputChangeEvent } from '@metamask/snaps-sdk';
import { UserInputEventType, type UserInputEvent } from '@metamask/snaps-sdk';
import { is } from 'superstruct';

import { estimateFee } from '../../rpcs';
import type { SendFlowRequest } from '../../stateManagement';
import { generateSendFlowComponent } from '../components';
import { ConfirmationNames } from '../components/Confirmations';
import { SendFlowNames } from '../components/SendFlowInput';

export const validateSendManyEvent = (event: UserInputEvent) => {
  if (
    ![
      ...Object.values(ConfirmationNames),
      ...Object.values(SendFlowNames),
    ].includes(event.name as ConfirmationNames | SendFlowNames)
  ) {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Unknown input event name: ${event.name}`);
  }
};

const handleSendManyInputEvent = async (
  sendRequest: SendFlowRequest,
  event: InputChangeEvent,
) => {
  const updatedRequest = { ...sendRequest }; // Create a copy to avoid mutating the original object

  switch (event.name) {
    case SendFlowNames.RecipientInput: {
      const address = event.value as string;

      // TODO: validate other btc address types
      if (is(address, BtcP2wpkhAddressStruct)) {
        updatedRequest.validation.recipient = true;
        updatedRequest.transaction.recipient = address;
      } else {
        updatedRequest.validation.recipient = false;
      }
      updatedRequest.transaction.recipient = event.value as string;
      return updatedRequest;
    }
    case SendFlowNames.AmountInput: {
      const amount = parseFloat(event.value as string);
      if (isNaN(amount) || amount <= 0) {
        updatedRequest.validation.amount = false;
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id: sendRequest.id,
            ui: generateSendFlowComponent(sendRequest),
          },
        });
        return sendRequest;
      }

      updatedRequest.validation.amount = true;
      updatedRequest.transaction.amount = amount.toString();
      updatedRequest.estimates.fees.loading = true;
      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id: sendRequest.id,
          ui: generateSendFlowComponent(sendRequest),
        },
      });

      let fees;
      try {
        fees = await estimateFee({
          account: sendRequest.account,
          amount: event.value as string,
        });
      } catch (feeError) {
        updatedRequest.estimates.fees.loading = false;
        updatedRequest.errors.fees = 'Failed to estimate fees';
      }
      updatedRequest.estimates.fees = {
        fee: {
          amount: fees.fee.amount,
          unit: fees.fee.unit,
        },
        loading: false,
      };
      updatedRequest.transaction.total = (
        parseFloat(updatedRequest.transaction.amount) +
        parseFloat(fees.fee.amount)
      ).toString();
      return updatedRequest;
    }
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unknown input event name: ${event.name}`);
  }
};

const handleSendManyButtonEvent = async (
  sendRequest: SendFlowRequest,
  event: ButtonClickEvent,
) => {
  switch (event.name) {
    case ConfirmationNames.CancelButton:
      if (sendRequest.step === 'send') {
        sendRequest.step = 'review';
      }
      return sendRequest;
    case ConfirmationNames.ReviewButton:
      sendRequest.step = 'send';
      return sendRequest;
    default:
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unknown input event name: ${event.name}`);
  }
};

export const sendManyInputHandler = async ({
  sendRequest,
  event,
}: {
  sendRequest: SendFlowRequest;
  event: UserInputEvent;
}) => {
  validateSendManyEvent(event);
  const { type: eventType }: UserInputEvent = event;

  switch (eventType) {
    case UserInputEventType.ButtonClickEvent:
      return await handleSendManyButtonEvent(
        sendRequest,
        event as ButtonClickEvent,
      );
      break;
    case UserInputEventType.InputChangeEvent:
      return await handleSendManyInputEvent(
        sendRequest,
        event as InputChangeEvent,
      );
      break;
    default:
      throw new Error('Unknown event type');
  }
};
