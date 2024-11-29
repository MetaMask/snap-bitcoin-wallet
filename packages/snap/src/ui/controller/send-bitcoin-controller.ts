import type { UserInputEvent } from '@metamask/snaps-sdk';
import { UserInputEventType } from '@metamask/snaps-sdk';
import { BigNumber } from 'bignumber.js';

import { TransactionDustError } from '../../bitcoin/wallet';
import { estimateFee, getMaxSpendableBalance } from '../../rpcs';
import type { KeyringStateManager } from '../../stateManagement';
import { TransactionStatus, type SendFlowRequest } from '../../stateManagement';
import { SendFormNames } from '../components/SendForm';
import {
  displayConfirmationReview,
  updateSendFlow,
} from '../render-interfaces';
import { AssetType, type SendFlowContext, type SendFormState } from '../types';
import { btcToFiat, fiatToBtc, formValidation, validateTotal } from '../utils';

export const isSendFormEvent = (event: UserInputEvent): boolean => {
  return Object.values(SendFormNames).includes(event?.name as SendFormNames);
};

export class SendBitcoinController {
  protected stateManager: KeyringStateManager;

  context: SendFlowContext;

  interfaceId: string;

  constructor({
    context,
    interfaceId,
  }: {
    context: SendFlowContext;
    interfaceId: string;
  }) {
    this.context = context;
    this.interfaceId = interfaceId;
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
    // If there isn't an interfaceId, return early because the interface is not ready.
    if (!this.context.request.interfaceId) {
      return;
    }

    formValidation(formState, context, this.context.request);

    switch (eventName) {
      case SendFormNames.To: {
        this.context.request.recipient.address = formState.to;
        this.context.request.recipient.valid = Boolean(
          !this.context.request.recipient.error,
        );
        await updateSendFlow({
          request: this.context.request,
        });
        break;
      }
      case SendFormNames.Amount: {
        if (this.context.request.amount.error) {
          await updateSendFlow({
            request: this.context.request,
          });
          return;
        }
        this.context.request.amount.valid = Boolean(
          !this.context.request.amount.error,
        );
        this.context.request.fees.loading = true;

        // show loading state for fees
        await updateSendFlow({
          request: this.context.request,
        });

        if (this.context.request.selectedCurrency === AssetType.BTC) {
          this.context.request.amount.amount = formState.amount;
          this.context.request.amount.fiat = btcToFiat(
            formState.amount,
            this.context.request.rates,
          );
        } else {
          this.context.request.amount.fiat = formState.amount;
          this.context.request.amount.amount = fiatToBtc(
            formState.amount,
            this.context.request.rates,
          );
        }

        try {
          const estimates = await estimateFee({
            account: this.context.accounts[0].id,
            amount: this.context.request.amount.amount,
          });
          this.context.request.fees = {
            fiat: btcToFiat(estimates.fee.amount, this.context.request.rates),
            amount: estimates.fee.amount,
            loading: false,
            error: '',
          };
          this.context.request.total = validateTotal(
            this.context.request.amount.amount,
            estimates.fee.amount,
            this.context.request.balance.amount,
            this.context.request.rates,
          );
        } catch (feeError) {
          if (feeError instanceof TransactionDustError) {
            this.context.request.amount.error = feeError.message;
            this.context.request.fees.loading = false;
          } else {
            this.context.request.fees = {
              fiat: '',
              amount: '',
              loading: false,
              error: feeError.message,
            };
          }
        }
        await updateSendFlow({
          request: this.context.request,
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
        if (this.context.request.status === TransactionStatus.Review) {
          this.context.request.status = TransactionStatus.Draft;
          return await updateSendFlow({
            request: this.context.request,
            flushToAddress: false,
            backEventTriggered: true,
          });
        } else if (this.context.request.status === TransactionStatus.Draft) {
          this.context.request.status = TransactionStatus.Rejected;
          return await this.resolveInterface(this.context.request);
        }
        throw new Error('Invalid state');
      }
      case SendFormNames.Clear:
        this.context.request.recipient = {
          address: '',
          error: '',
          valid: false,
        };
        return await updateSendFlow({
          request: this.context.request,
          flushToAddress: true,
        });
      case SendFormNames.Cancel:
      case SendFormNames.Close: {
        this.context.request.status = TransactionStatus.Rejected;
        await this.resolveInterface(this.context.request);
        return null;
      }
      case SendFormNames.SwapCurrencyDisplay: {
        this.context.request.selectedCurrency =
          this.context.request.selectedCurrency === AssetType.BTC
            ? AssetType.FIAT
            : AssetType.BTC;
        return await updateSendFlow({
          request: this.context.request,
          flushToAddress: false,
          currencySwitched: true,
        });
      }
      case SendFormNames.Review: {
        this.context.request.status = TransactionStatus.Review;
        await displayConfirmationReview({ request: this.context.request });
        return null;
      }
      case SendFormNames.Send: {
        this.context.request.status = TransactionStatus.Signed;
        await this.resolveInterface(this.context.request);
        return null;
      }
      case SendFormNames.SetMax: {
        this.context.request.fees.loading = true;
        await updateSendFlow({
          request: this.context.request,
        });
        return await this.handleSetMax();
      }
      default:
        return null;
    }
  }

  async resolveInterface(value: SendFlowRequest): Promise<void> {
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
        this.context.request.amount.error = 'Fees exceed max sendable amount';
        this.context.request.fees.loading = false;
      } else {
        this.context.request.amount = {
          amount: maxAmount.balance.amount,
          fiat: btcToFiat(maxAmount.balance.amount, this.context.request.rates),
          error: '',
          valid: true,
        };
        this.context.request.fees = {
          amount: maxAmount.fee.amount,
          fiat: btcToFiat(maxAmount.fee.amount, this.context.request.rates),
          loading: false,
          error: '',
        };
        this.context.request.total = validateTotal(
          maxAmount.balance.amount,
          maxAmount.fee.amount,
          this.context.request.balance.amount,
          this.context.request.rates,
        );
      }
    } catch (error) {
      this.context.request.amount.error = `Error fetching max amount: ${
        error.message as string
      }`;
      this.context.request.fees.loading = false;
    }

    return await updateSendFlow({
      request: this.context.request,
      currencySwitched: true,
    });
  }
}
