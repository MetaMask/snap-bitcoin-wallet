import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { BigNumber } from 'bignumber.js';

import { estimateFee } from '../../rpcs';
import type { KeyringStateManager } from '../../stateManagement';
import { type SendFlowRequest } from '../../stateManagement';
import { logger } from '../../utils';
import { ReviewTransaction } from '../components';
import { SendFormNames } from '../components/SendForm';
import type { SendFlowContext, SendFormErrors, SendFormState } from '../types';
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
    const formErrors: SendFormErrors = formValidation(
      formState,
      context,
      this.request.balance,
      this.request.selectedCurrency,
      this.request.rates,
    );

    logger.log('formErrors', formErrors);

    switch (eventName) {
      case SendFormNames.To: {
        this.request.recipient = {
          address: formState.to,
          error: formErrors.to,
          valid: !formErrors.to,
        };
        await this.persistRequest(this.request);
        break;
      }
      case SendFormNames.AccountSelector: // this does nothing at the moment.
      case SendFormNames.Amount: {
        if (
          !formErrors.amount &&
          new BigNumber(formState.amount).gte(new BigNumber(0))
        ) {
          this.request.amount = {
            amount:
              this.request.selectedCurrency === AssetType.BTC
                ? formState.amount
                : convertFiatToBtc(formState.amount, this.request.rates),
            fiat:
              this.request.selectedCurrency === AssetType.BTC
                ? convertBtcToFiat(formState.amount, this.request.rates)
                : formState.amount,
            error: formErrors.amount,
            valid: !formErrors.amount,
          };
          this.request.fees.loading = true;

          // show loading state for fees
          await updateSendFlow({
            request: this.request,
            flushToAddress: false,
            displayClearIcon: Boolean(formState.to) && formState.to !== '',
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

            await this.persistRequest({
              ...this.request,
            });
          } catch (feeError) {
            this.request.fees = {
              fiat: '',
              amount: '',
              loading: false,
              error: feeError.message,
            };
            await this.persistRequest({
              ...this.request,
            });
          }
        } else {
          this.request.amount = {
            amount: formState.amount,
            fiat: formState.amount,
            error: formErrors.amount,
            valid: !formErrors.amount,
          };
          await this.persistRequest(this.request);
        }
        break;
      }
      default:
        break;
    }

    logger.log('sendmanycontroller updating send flow');

    await updateSendFlow({
      request: this.request,
      flushToAddress: false,
      displayClearIcon: true,
    });
  }

  async handleButtonEvent(
    eventName: SendFormNames,
    context: SendFlowContext,
    formState: SendFormState,
  ) {
    switch (eventName) {
      case SendFormNames.Clear:
        this.request.recipient = {
          address: '',
          error: '',
          valid: false,
        };
        await this.persistRequest(this.request);
        return await updateSendFlow({
          request: this.request,
          flushToAddress: false,
          displayClearIcon: true,
        });
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
          switchValue: true,
        });
      }
      case SendFormNames.Review: {
        return await snap.request({
          method: 'snap_updateInterface',
          params: {
            id: this.request.interfaceId,
            ui: <ReviewTransaction {...this.request} txSpeed={'30m'} />,
          },
        });
      }
      case SendFormNames.Send: {
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
