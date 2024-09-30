import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { BigNumber } from 'bignumber.js';

import { estimateFee } from '../../rpcs';
import type { KeyringStateManager } from '../../stateManagement';
import { type SendFlowRequest } from '../../stateManagement';
import { logger } from '../../utils';
import { SendFormNames } from '../components/SendForm';
import type { SendFlowContext, SendFormErrors, SendFormState } from '../types';
import { ReviewTransaction } from '../components';
import {
  AssetType,
  convertBtcToFiat,
  convertFiatToBtc,
  formValidation,
  updateSendFlow,
} from '../utils';

export const isSendFormEvent = (event: UserInputEvent): boolean => {
  return Object.values(SendFormNames).includes(event?.name as SendFormNames);
};

export class SendManyController {
  protected stateManager: KeyringStateManager;

  request: SendFlowRequest;

  context: SendFlowContext;

  event: UserInputEvent;

  interfaceId: string;

  constructor({
    stateManager,
    request,
    context,
    event,
    interfaceId,
  }: {
    stateManager: KeyringStateManager;
    request: SendFlowRequest;
    context: SendFlowContext;
    event: UserInputEvent;
    interfaceId: string;
  }) {
    this.stateManager = stateManager;
    this.request = request;
    this.context = context;
    this.event = event;
    this.interfaceId = interfaceId;
  }

  async persistRequest(request: Partial<SendFlowRequest>) {
    await this.stateManager.upsertRequest({
      ...this.request,
      ...request,
    });
  }

  async handleEvent(
    event: UserInputEvent,
    context: SendFlowContext,
    formState: SendFormState,
  ) {
    if (!isSendFormEvent(event)) {
      return;
    }

    switch (event.type) {
      case UserInputEventType.InputChangeEvent: {
        await this.handleInputEvent(
          event.name as SendFormNames,
          context,
          formState,
        );
        break;
      }
      case UserInputEventType.ButtonClickEvent: {
        await this.handleButtonEvent(
          event.name as SendFormNames,
          context,
          formState,
        );
        break;
      }
      default:
        break;
    }
  }

  async handleInputEvent(
    eventName: SendFormNames,
    context: SendFlowContext,
    formState: SendFormState,
  ) {
    try {
      formValidation(formState, context, this.request);
    } catch (e) {
      console.log(e);
    }

    logger.log('formErrors', JSON.stringify(this.request, null, 4));

    let displayClearIcon = Boolean(formState.to) && formState.to !== '';

    switch (eventName) {
      case SendFormNames.To: {
        await this.persistRequest(this.request);
        await updateSendFlow({
          request: this.request,
          displayClearIcon,
        });
        break;
      }
      case SendFormNames.Amount: {
        if (
          this.request.amount.error ||
          new BigNumber(formState.amount).eq(
            new BigNumber(this.request.amount.amount),
          )
        ) {
          return await updateSendFlow({
            request: this.request,
            displayClearIcon,
          });
        }
        this.request.fees.loading = true;

        // show loading state for fees
        await updateSendFlow({
          request: this.request,
          displayClearIcon,
        });

        const amountInBtc =
          this.request.selectedCurrency === AssetType.BTC
            ? formState.amount
            : convertFiatToBtc(formState.amount, this.request.rates);

        try {
          const estimates = await estimateFee({
            account: this.context.accounts[0].id,
            amount: amountInBtc,
          });
          // TODO: fiat conversion
          this.request.fees = {
            fiat: convertBtcToFiat(estimates.fee.amount, this.request.rates),
            amount: estimates.fee.amount,
            loading: false,
            error: '',
          };
          const updatedTotal = new BigNumber(amountInBtc)
            .plus(new BigNumber(this.request.fees.amount))
            .toString();
          this.request.total = {
            amount: updatedTotal,
            fiat: convertBtcToFiat(updatedTotal, this.request.rates),
          };

          await this.persistRequest(this.request);
        } catch (feeError) {
          this.request.fees = {
            fiat: '',
            amount: '',
            loading: false,
            error: feeError.message,
          };
          await this.persistRequest(this.request);
        }
        await updateSendFlow({
          request: this.request,
          displayClearIcon,
        });
        break;
      }
      default:
        return;
    }
  }

  async handleButtonEvent(eventName: SendFormNames) {
    switch (eventName) {
      case SendFormNames.HeaderBack: {
        if (this.request.status === 'review') {
          this.request.status = 'draft';
          await this.persistRequest(this.request);
          return await updateSendFlow({
            request: this.request,
            flushToAddress: false,
            displayClearIcon: true,
            backEventTriggered: true,
          });
        } else if (this.request.status === 'draft') {
          this.request.status = 'rejected';
          await this.persistRequest(this.request);
          return await snap.request({
            method: 'snap_resolveInterface',
            params: {
              id: this.interfaceId,
              value: false,
            },
          });
        }
        throw new Error('Invalid state');
      }
      case SendFormNames.Clear:
        this.request.recipient = {
          address: '',
          error: '',
          valid: false,
        };
        await this.persistRequest(this.request);
        return await updateSendFlow({
          request: this.request,
          flushToAddress: true,
          displayClearIcon: true,
        });
      case SendFormNames.Cancel:
      case SendFormNames.Close: {
        this.request.status = 'rejected';
        await this.persistRequest(this.request);
        return await snap.request({
          method: 'snap_resolveInterface',
          params: {
            id: this.interfaceId,
            value: false,
          },
        });
      }
      case SendFormNames.SwapCurrencyDisplay: {
        this.request.selectedCurrency =
          this.request.selectedCurrency === AssetType.BTC
            ? AssetType.FIAT
            : AssetType.BTC;
        await this.persistRequest(this.request);
        return await updateSendFlow({
          request: this.request,
          flushToAddress: false,
          displayClearIcon: true,
          currencySwitched: true,
        });
      }
      case SendFormNames.Review: {
        this.request.status = 'review';
        await this.persistRequest(this.request);
        return await snap.request({
          method: 'snap_updateInterface',
          params: {
            id: this.request.interfaceId,
            ui: <ReviewTransaction {...this.request} txSpeed={'30m'} />,
          },
        });
      }
      case SendFormNames.Send: {
        this.request.status = 'signed';
        await this.persistRequest(this.request);
        return await snap.request({
          method: 'snap_resolveInterface',
          params: {
            id: this.interfaceId,
            value: true,
          },
        });
      }
      default:
        break;
    }
  }
}
