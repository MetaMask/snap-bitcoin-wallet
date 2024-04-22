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
import type {
  SnapRpcRequestHandlerRequest,
  IStaticSnapRpcRequestHandler,
} from './rpcs';
import { CreateAccountHandler, GetBalancesHandler } from './rpcs';

const validateOrigin = async (origin: string) => {
  // TODO: validate origin
  if (origin === '') {
    throw new SnapError('Origin not found');
  }
};

const getHandler = (method: string): IStaticSnapRpcRequestHandler => {
  switch (method) {
    case 'bitcoin_createAccount':
      return CreateAccountHandler;
    case 'bitcoin_getBalances':
      return GetBalancesHandler;
    default:
      throw new SnapError(`Method not found`);
  }
};

export const onRpcRequest: OnRpcRequestHandler = async (args) => {
  const { request, origin } = args;

  logger.logLevel = parseInt(Config.logLevel, 10);

  await validateOrigin(origin);

  const { method } = request;

  const handler = getHandler(method);

  return await handler
    .getInstance()
    .execute(request.params as SnapRpcRequestHandlerRequest);
};

export const onKeyringRequest: OnKeyringRequestHandler = async ({
  request,
}): Promise<Json> => {
  logger.logLevel = parseInt(Config.logLevel, 10);

  const keyring = Factory.createKeyring(Chain.Bitcoin);

  return handleKeyringRequest(keyring, request) as unknown as Promise<Json>;
};
