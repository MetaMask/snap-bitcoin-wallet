import { handleKeyringRequest } from '@metamask/keyring-api';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type Json,
  SnapError,
} from '@metamask/snaps-sdk';

import { Config } from './modules/config';
import { originPermissions } from './modules/config/permissions';
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
    if (error instanceof SnapError) {
      throw error;
    }
    throw new SnapError(error.message);
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
    if (error instanceof SnapError) {
      throw error;
    }
    throw new SnapError(error.message);
  }
};
