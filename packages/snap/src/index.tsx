import { handleKeyringRequest } from '@metamask/keyring-api';
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
import { formValidation, updateSendFlow } from './ui/utils';
import { SendFlow } from './ui/components';
import { SendFormNames } from './ui/components/SendForm';

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
  const {
    selectedCurrency,
    fees: previousFees,
    accounts,
    scope,
  } = context as SendFlowContext;

  const state = await snap.request({
    method: 'snap_getInterfaceState',
    params: { id },
  });

  logger.log('onUserInput', state);

  const sendForm = state.sendForm as SendFormState;

  const formErrors = formValidation(sendForm, context as SendFlowContext);

  logger.log('formErrors', formErrors);

  let fees = previousFees;

  // skip call if there is an error with the amount.
  if (
    event?.name === SendFormNames.Amount &&
    !formErrors.amount &&
    Number(sendForm.amount) > 0
  ) {
    // show loading state for fees
    await updateSendFlow({
      interfaceId: id,
      fees,
      account: accounts[0],
      selectedCurrency,
      isLoading: true,
      total: { amount: '0', fiat: 0 }, // This is a placeholder value since it will display loading state.
      scope,
    });

    try {
      const estimates = await estimateFee({
        account: accounts[0].id,
        amount: sendForm.amount,
      });
      // TODO: fiat conversion
      fees.amount = estimates.fee.amount;
    } catch (feeError) {
      formErrors.fees = 'Error fetching fees';
    }
  }

  const total = {
    amount: (Number(sendForm.amount ?? 0) + Number(fees.amount)).toString(),
    // TODO: fiat conversion
    fiat: 0,
  };

  if (event.type === UserInputEventType.InputChangeEvent) {
    switch (event.name) {
      case SendFormNames.Amount:
      case SendFormNames.To:
      case 'accountSelector': {
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: (
              <SendFlow
                account={accounts[0]}
                selectedCurrency={selectedCurrency}
                total={{ amount: total.amount.toString(), fiat: total.fiat }}
                fees={fees}
                displayClearIcon={Boolean(sendForm.to) && sendForm.to !== ''}
                errors={formErrors}
                isLoading={false}
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
                total={total}
                fees={fees}
                flushToAddress={true}
                displayClearIcon={false}
                errors={formErrors}
                isLoading={false}
              />
            ),
          },
        });
        break;
      case SendFormNames.Close:
        // TODO:
        break;
      default:
        break;
    }
  }

  // validate values
  // if (event.type === UserInputEventType.InputChangeEvent) {
  //   if (event.name === SendFlowNames.AmountInput) {
  //     const amount = parseFloat(event.value as string);
  //     if (isNaN(amount) || amount < 0) {
  //       existingRequest.validation.amount = false;
  //     }
  //     existingRequest.transaction.amount = amount.toString();
  //     existingRequest.estimates.fees.loading = true;
  //     existingRequest.validation.amount = true;
  //     await snap.request({
  //       method: 'snap_updateInterface',
  //       params: {
  //         id,
  //         ui: generateSendFlowComponent(existingRequest),
  //       },
  //     });

  //     // TODO: error handling
  //     const fees = await estimateFee({
  //       account: existingRequest.account,
  //       amount: event.value as string,
  //     });
  //     existingRequest.estimates.fees = {
  //       fee: {
  //         amount: fees.fee.amount,
  //         unit: fees.fee.unit,
  //       },
  //       loading: false,
  //     };
  //     existingRequest.transaction.total = (
  //       parseFloat(existingRequest.transaction.amount) +
  //       parseFloat(fees.fee.amount)
  //     ).toString();
  //   } else if (event.name === SendFlowNames.RecipientInput) {
  //     const address = event.value as string;

  //     // TODO: validate other btc address types
  //     if (is(address, BtcP2wpkhAddressStruct)) {
  //       existingRequest.validation.recipient = true;
  //       existingRequest.transaction.recipient = address;
  //     } else {
  //       existingRequest.validation.recipient = false;
  //     }
  //   }
  // }

  // if (event.type === UserInputEventType.ButtonClickEvent) {
  //   if (event.name === ConfirmationNames.ReviewButton) {
  //     existingRequest.step = 'send';
  //   } else if (event.name === ConfirmationNames.SendButton) {
  //     existingRequest.step = 'send';
  //     existingRequest.status = 'pending';
  //   } else if (event.name === ConfirmationNames.CancelButton) {
  //     existingRequest.step = 'review';
  //   }
  // }

  // const updatedRequest = await sendManyInputHandler({
  //   sendRequest: existingRequest,
  //   event,
  // });

  // await stateManager.upsertRequest(updatedRequest);
  // await snap.request({
  //   method: 'snap_updateInterface',
  //   params: {
  //     id,
  //     ui: generateSendFlowComponent(updatedRequest),
  //   },
  // });
};
