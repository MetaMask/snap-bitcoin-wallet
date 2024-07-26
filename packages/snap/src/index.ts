import { handleKeyringRequest } from '@metamask/keyring-api';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type Json,
  UnauthorizedError,
  SnapError,
  MethodNotFoundError,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import { BtcKeyring } from './keyring';
import { InternalRpcMethod, originPermissions } from './permissions';
import type { GetTransactionStatusParams, EstimateFeeParams } from './rpcs';
import { getTransactionStatus, estimateFee } from './rpcs';
import type { GetMaxSpendableBalanceParams } from './rpcs/get-max-spendable-balance';
import { getMaxSpendableBalance } from './rpcs/get-max-spendable-balance';
import { KeyringStateManager } from './stateManagement';
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
  logger.logLevel = parseInt(Config.logLevel, 10);

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
