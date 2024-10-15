import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { BigNumber } from 'bignumber.js';

import { estimateFee, getMaxSpendableBalance } from '../../rpcs';
import type { KeyringStateManager } from '../../stateManagement';
import { TransactionStatus, type SendFlowRequest } from '../../stateManagement';
import { SendFormNames } from '../components/SendForm';
import {
  generateConfirmationReviewInterface,
  updateSendFlow,
} from '../render-interfaces';
import { AssetType, type SendFlowContext, type SendFormState } from '../types';
import { btcToFiat, fiatToBtc, formValidation, validateTotal } from '../utils';

export const isSendFormEvent = (event: UserInputEvent): boolean => {
  return Object.values(SendFormNames).includes(event?.name as SendFormNames);
};

export class SendManyController {
  protected stateManager: KeyringStateManager;

  request: SendFlowRequest;

  context: SendFlowContext;

  interfaceId: string;

  constructor({
    stateManager,
    request,
    context,
    interfaceId,
  }: {
    stateManager: KeyringStateManager;
    request: SendFlowRequest;
    context: SendFlowContext;
    interfaceId: string;
  }) {
    this.stateManager = stateManager;
    this.request = request;
    this.context = context;
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
        await this.handleButtonEvent(event.name as SendFormNames);
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
  ): Promise<void> {
    formValidation(formState, context, this.request);

    switch (eventName) {
      case SendFormNames.To: {
        this.request.recipient.address = formState.to;
        this.request.recipient.valid = Boolean(!this.request.recipient.error);
        await this.persistRequest(this.request);
        await updateSendFlow({
          request: this.request,
        });
        break;
      }
      case SendFormNames.Amount: {
        if (this.request.amount.error) {
          await updateSendFlow({
            request: this.request,
          });
          return;
        }
        this.request.amount.valid = Boolean(!this.request.amount.error);
        this.request.fees.loading = true;

        // show loading state for fees
        await updateSendFlow({
          request: this.request,
        });

        if (this.request.selectedCurrency === AssetType.BTC) {
          this.request.amount.amount = formState.amount;
          this.request.amount.fiat = btcToFiat(
            formState.amount,
            this.request.rates,
          );
        } else {
          this.request.amount.fiat = formState.amount;
          this.request.amount.amount = fiatToBtc(
            formState.amount,
            this.request.rates,
          );
        }

        try {
          const estimates = await estimateFee({
            account: this.context.accounts[0].id,
            amount: this.request.amount.amount,
          });
          this.request.fees = {
            fiat: btcToFiat(estimates.fee.amount, this.request.rates),
            amount: estimates.fee.amount,
            loading: false,
            error: '',
          };
          this.request.total = validateTotal(
            this.request.amount.amount,
            estimates.fee.amount,
            this.request.balance.amount,
            this.request.rates,
          );
        } catch (feeError) {
          this.request.fees = {
            fiat: '',
            amount: '',
            loading: false,
            error: feeError.message,
          };
        }
        await this.persistRequest(this.request);
        await updateSendFlow({
          request: this.request,
        });
        break;
      }
      default:
        break;
    }
  }

  async handleButtonEvent(eventName: SendFormNames): Promise<void | null> {
    switch (eventName) {
      case SendFormNames.HeaderBack: {
        if (this.request.status === TransactionStatus.Review) {
          this.request.status = TransactionStatus.Draft;
          await this.persistRequest(this.request);
          return await updateSendFlow({
            request: this.request,
            flushToAddress: false,
            backEventTriggered: true,
          });
        } else if (this.request.status === TransactionStatus.Draft) {
          this.request.status = TransactionStatus.Rejected;
          await this.persistRequest(this.request);
          return await this.resolveInterface(false);
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
        });
      case SendFormNames.Cancel:
      case SendFormNames.Close: {
        this.request.status = TransactionStatus.Rejected;
        await this.persistRequest(this.request);
        await this.resolveInterface(false);
        return null;
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
          currencySwitched: true,
        });
      }
      case SendFormNames.Review: {
        this.request.status = TransactionStatus.Review;
        await this.persistRequest(this.request);
        await generateConfirmationReviewInterface({ request: this.request });
        return null;
      }
      case SendFormNames.Send: {
        this.request.status = TransactionStatus.Signed;
        await this.persistRequest(this.request);
        await this.resolveInterface(true);
        return null;
      }
      case SendFormNames.SetMax: {
        this.request.fees.loading = true;
        await updateSendFlow({
          request: this.request,
        });
        return await this.handleSetMax();
      }
      default:
        return null;
    }
  }

  async resolveInterface(value: boolean): Promise<void> {
    await snap.request({
      method: 'snap_resolveInterface',
      params: {
        id: this.interfaceId,
        value,
      },
    });
  }

  async handleSetMax() {
    try {
      const maxAmount = await getMaxSpendableBalance({
        account: this.context.accounts[0].id,
      });
      if (new BigNumber(maxAmount.balance.amount).lte(new BigNumber(0))) {
        this.request.amount.error = 'Fees exceed max sendable amount';
        this.request.fees.loading = false;
      } else {
        this.request.amount = {
          amount: maxAmount.balance.amount,
          fiat: btcToFiat(maxAmount.balance.amount, this.request.rates),
          error: '',
          valid: true,
        };
        this.request.fees = {
          amount: maxAmount.fee.amount,
          fiat: btcToFiat(maxAmount.fee.amount, this.request.rates),
          loading: false,
          error: '',
        };
        this.request.total = validateTotal(
          maxAmount.balance.amount,
          maxAmount.fee.amount,
          this.request.balance.amount,
          this.request.rates,
        );
      }
    } catch (error) {
      this.request.amount.error = `Error fetching max amount: ${
        error.message as string
      }`;
      this.request.fees.loading = false;
    }

    await this.persistRequest(this.request);
    return await updateSendFlow({
      request: this.request,
      currencySwitched: true,
    });
  }
}
