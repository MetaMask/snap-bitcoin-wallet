import {
  BtcP2wpkhAddressStruct,
  handleKeyringRequest,
} from '@metamask/keyring-api';
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
import { is } from 'superstruct';

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
import { generateSendFlowComponent } from './ui/components';
import { SendFlowNames } from './ui/SendFlow';
import { isSnapRpcError, logger } from './utils';

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
  logger.logLevel = parseInt(Config.logLevel, 10);

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

export const onUserInput: OnUserInputHandler = async ({ id, event }) => {
  // TODO: refactor to another function
  // get existing values from request id
  const stateManager = new KeyringStateManager();
  const existingRequest = await stateManager.getRequest(id);

  if (!existingRequest) {
    throw new Error(`missing request id: ${id}`);
  }

  // validate values
  if (event.type === UserInputEventType.InputChangeEvent) {
    if (event.name === SendFlowNames.AmountInput) {
      const amount = parseFloat(event.value as string);
      if (isNaN(amount) || amount < 0) {
        existingRequest.validation.amount = false;
      }
      existingRequest.transaction.amount = amount.toString();
      existingRequest.validation.amount = true;
    } else if (event.name === SendFlowNames.RecipientInput) {
      const address = event.value as string;

      // TODO: validate other btc address types
      if (is(address, BtcP2wpkhAddressStruct)) {
        existingRequest.validation.recipient = true;
      } else {
        existingRequest.validation.recipient = false;
      }
    }

    await stateManager.upsertRequest(existingRequest);
    await snap.request({
      method: 'snap_updateInterface',
      params: {
        id,
        ui: generateSendFlowComponent(existingRequest),
      },
    });
  }
};
