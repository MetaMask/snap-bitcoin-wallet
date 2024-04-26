import { handleKeyringRequest } from '@metamask/keyring-api';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type Json,
  SnapError,
  MethodNotFoundError,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import { originPermissions } from './config/permissions';
import { Factory } from './modules/factory';
import { logger } from './modules/logger/logger';
import type { SnapRpcHandlerRequest } from './rpcs';
import { RpcHelper } from './rpcs/helpers';

export const validateOrigin = (origin: string, method: string) => {
  if (!origin) {
    throw new SnapError('Origin not found');
  }
  if (!originPermissions.get(origin)?.has(method)) {
    throw new SnapError(`Permission denied`);
  }
};

export const onRpcRequest: OnRpcRequestHandler = async (args) => {
  try {
    const { request, origin } = args;
    const { method } = request;
    validateOrigin(origin, method);

    logger.logLevel = parseInt(Config.logLevel, 10);

    return await RpcHelper.getChainApiHandler(method)
      .getInstance()
      .execute(request.params as SnapRpcHandlerRequest);
  } catch (error) {
    let snapError = error;
    if (
      !(snapError instanceof MethodNotFoundError || error instanceof SnapError)
    ) {
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
  try {
    validateOrigin(origin, request.method);

    logger.logLevel = parseInt(Config.logLevel, 10);

    const keyring = Factory.createKeyring(Config.chain);
    return (await handleKeyringRequest(
      keyring,
      request,
    )) as unknown as Promise<Json>;
  } catch (error) {
    let snapError = error;
    if (
      !(snapError instanceof MethodNotFoundError || error instanceof SnapError)
    ) {
      snapError = new SnapError(error);
    }
    logger.error(
      `onKeyringRequest error: ${JSON.stringify(snapError.toJSON(), null, 2)}`,
    );
    throw snapError;
  }
};
