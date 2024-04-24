import { handleKeyringRequest } from '@metamask/keyring-api';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type Json,
  SnapError,
} from '@metamask/snaps-sdk';

import { Chain, Config } from './modules/config';
import { Factory } from './modules/factory';
import { logger } from './modules/logger/logger';
import type { SnapRpcHandlerRequest, IStaticSnapRpcHandler } from './rpcs';
import {
  CreateAccountHandler,
  EstimateFeesHandler,
  GetBalancesHandler,
} from './rpcs';

const validateOrigin = async (origin: string) => {
  // TODO: validate origin
  if (origin === '') {
    throw new SnapError('Origin not found');
  }
};

const getHandler = (method: string): IStaticSnapRpcHandler => {
  switch (method) {
    case 'chain_createAccount':
      return CreateAccountHandler;
    case 'chain_getBalances':
      return GetBalancesHandler;
    case 'chain_estimateFees':
      return EstimateFeesHandler;
    default:
      throw new SnapError(`Method not found`);
  }
};

export const onRpcRequest: OnRpcRequestHandler = async (args) => {
  try {
    logger.logLevel = parseInt(Config.logLevel, 10);
    const { request, origin } = args;
    const { method } = request;
    await validateOrigin(origin);

    return await getHandler(method)
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
  request,
}): Promise<Json> => {
  try {
    logger.logLevel = parseInt(Config.logLevel, 10);
    const keyring = Factory.createKeyring(Chain.Bitcoin);
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
