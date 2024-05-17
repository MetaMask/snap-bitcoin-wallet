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
import { originPermissions } from './config/permissions';
import { Factory } from './factory';
import { logger } from './modules/logger/logger';
import type { SnapRpcHandlerRequest } from './modules/rpc';
import { RpcHelper } from './rpcs/helpers';
import { isSnapRpcError } from './utils';

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

export const onRpcRequest: OnRpcRequestHandler = async (args) => {
  logger.logLevel = parseInt(Config.logLevel, 10);

  try {
    const { request, origin } = args;
    const { method } = request;
    validateOrigin(origin, method);

    const methodHanlders = RpcHelper.getChainRpcApiHandlers();

    if (!Object.prototype.hasOwnProperty.call(methodHanlders, method)) {
      throw new MethodNotFoundError() as unknown as Error;
    }

    return await methodHanlders[method]
      .getInstance()
      .execute(request.params as SnapRpcHandlerRequest);
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

export const onKeyringRequest: OnKeyringRequestHandler = async ({
  origin,
  request,
}): Promise<Json> => {
  logger.logLevel = parseInt(Config.logLevel, 10);

  try {
    validateOrigin(origin, request.method);

    const keyring = Factory.createKeyring();
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
