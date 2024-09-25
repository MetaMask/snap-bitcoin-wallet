import { handleKeyringRequest } from '@metamask/keyring-api';
import { BigNumber } from 'bignumber.js';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type OnUserInputHandler,
  type Json,
  UnauthorizedError,
  SnapError,
  MethodNotFoundError,
  UserInputEventType,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import { BtcKeyring } from './keyring';
import { InternalRpcMethod, originPermissions } from './permissions';
import type {
  GetTransactionStatusParams,
  EstimateFeeParams,
  GetMaxSpendableBalanceParams,
} from './rpcs';
import {
  getTransactionStatus,
  estimateFee,
  getMaxSpendableBalance,
} from './rpcs';
import { KeyringStateManager } from './stateManagement';
import { isSnapRpcError, logger } from './utils';
import { SendFlowContext, SendFormState } from './ui/types';
import {
  convertBtcToFiat,
  convertFiatToBtc,
  formValidation,
  updateSendFlow,
} from './ui/utils';
import { SendFlow } from './ui/components';
import { SendForm, SendFormNames } from './ui/components/SendForm';

export const validateOrigin = (origin: string, method: string): void => {
  if (!origin) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new UnauthorizedError('Origin not found');
  }
  if (!originPermissions.get(origin)?.has(method)) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new UnauthorizedError(`Permission denied`);
  }
};

export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}): Promise<Json> => {
  logger.logLevel = 6; //parseInt(Config.logLevel, 10);
  console.log('onRpcRequest', request, origin);

  try {
    const { method } = request;

    validateOrigin(origin, method);

    switch (method) {
      case InternalRpcMethod.GetTransactionStatus:
        return await getTransactionStatus(
          request.params as GetTransactionStatusParams,
        );
      case InternalRpcMethod.EstimateFee:
        return await estimateFee(request.params as EstimateFeeParams);
      case InternalRpcMethod.GetMaxSpendableBalance:
        return await getMaxSpendableBalance(
          request.params as GetMaxSpendableBalanceParams,
        );

      default:
        throw new MethodNotFoundError() as unknown as Error;
    }
  } catch (error) {
    let snapError = error;

    if (!isSnapRpcError(error)) {
      snapError = new SnapError(error);
    }
    logger.error(
      `onRpcRequest error: ${JSON.stringify(snapError.toJSON(), null, 2)}`,
    );
    throw snapError;
  }
};

export const onKeyringRequest: OnKeyringRequestHandler = async ({
  origin,
  request,
}): Promise<Json> => {
  logger.logLevel = 6;
  logger.log('onKeyringRequest', request, origin);

  try {
    validateOrigin(origin, request.method);

    const keyring = new BtcKeyring(new KeyringStateManager(), {
      defaultIndex: Config.wallet.defaultAccountIndex,
      origin,
    });

    return (await handleKeyringRequest(
      keyring,
      request,
    )) as unknown as Promise<Json>;
  } catch (error) {
    let snapError = error;

    if (!isSnapRpcError(error)) {
      snapError = new SnapError(error);
    }
    logger.error(
      `onKeyringRequest error: ${JSON.stringify(snapError.toJSON(), null, 2)}`,
    );
    throw snapError;
  }
};

export const onUserInput: OnUserInputHandler = async ({
  id,
  event,
  context,
}) => {
  const { selectedCurrency, accounts, scope } = context as SendFlowContext;

  const state = await snap.request({
    method: 'snap_getInterfaceState',
    params: { id },
  });

  const stateManager = new KeyringStateManager();
  const request = await stateManager.getRequest(id);
  logger.log('onUserInput request', JSON.stringify(request, null, 4));

  if (!request) {
    throw new Error('Request not found');
  }

  logger.log('onUserInput state', JSON.stringify(state, null, 4));
  logger.log('onUserInput event', JSON.stringify(event, null, 4));

  const sendForm = state.sendForm as SendFormState;

  const formErrors = formValidation(
    sendForm,
    context as SendFlowContext,
    request.balance,
    request.selectedCurrency,
    request.rates,
  );

  logger.log('formErrors', formErrors);

  let fees = request.fees;
  console.log('fees', fees);

  if (event.type === UserInputEventType.InputChangeEvent) {
    switch (event.name) {
      case SendFormNames.Amount:
      case SendFormNames.To:
      case 'accountSelector': {
        // skip call if there is an error with the amount.
        if (
          event?.name === SendFormNames.Amount &&
          !formErrors.amount &&
          new BigNumber(sendForm.amount).gte(new BigNumber(0))
        ) {
          // show loading state for fees
          await updateSendFlow({
            interfaceId: id,
            fees,
            account: accounts[0],
            selectedCurrency: request.selectedCurrency,
            isLoading: true,
            scope,
            balance: {
              amount: request.balance.amount,
              fiat: request.balance.fiat,
            },
            amount: sendForm.amount, // no need to convert because denomination is the same
            rates: request.rates,
          });

          try {
            const estimates = await estimateFee({
              account: accounts[0].id,
              amount:
                request.selectedCurrency === 'BTC'
                  ? sendForm.amount
                  : convertFiatToBtc(sendForm.amount, request.rates),
            });
            // TODO: fiat conversion
            fees.amount = estimates.fee.amount;
            fees.fiat = convertBtcToFiat(estimates.fee.amount, request.rates);
            await stateManager.upsertRequest({
              ...request,
              fees,
            });
          } catch (feeError) {
            formErrors.fees = 'Error fetching fees';
          }
        }

        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: (
              <SendFlow
                account={accounts[0]}
                selectedCurrency={selectedCurrency}
                fees={fees}
                displayClearIcon={Boolean(sendForm.to) && sendForm.to !== ''}
                errors={formErrors}
                isLoading={false}
                balance={request.balance}
                amount={sendForm.amount}
                rates={request.rates}
              />
            ),
          },
        });

        break;
      }
      default:
        break;
    }
  } else if (event.type === UserInputEventType.ButtonClickEvent) {
    switch (event.name) {
      case SendFormNames.Clear:
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: (
              <SendFlow
                account={accounts[0]}
                selectedCurrency={selectedCurrency}
                fees={fees}
                flushToAddress={true}
                displayClearIcon={false}
                errors={formErrors}
                isLoading={false}
                balance={request.balance}
                amount={request.amount}
              />
            ),
          },
        });
        break;
      case SendFormNames.Close:
        // TODO:
        break;
      case SendFormNames.SwapCurrencyDisplay: {
        const updatedRequest = {
          ...request,
          selectedCurrency: request.selectedCurrency === 'BTC' ? '$' : 'BTC',
        };
        const amount =
          request.selectedCurrency === 'BTC'
            ? convertBtcToFiat(sendForm.amount, request.rates)
            : convertFiatToBtc(sendForm.amount, request.rates);
        await stateManager.upsertRequest(updatedRequest);
        await updateSendFlow({
          interfaceId: id,
          fees,
          account: accounts[0],
          selectedCurrency: updatedRequest.selectedCurrency,
          isLoading: false,
          scope,
          balance: {
            amount: request.balance.amount,
            fiat: request.balance.fiat,
          },
          amount: amount,
        });
        break;
      }
      default:
        break;
    }
  }
};
