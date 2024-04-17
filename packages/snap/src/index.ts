import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { SnapError } from '@metamask/snaps-sdk';

import { LogLevel, logger } from './modules/logger/logger';
import type {
  SnapRpcRequestHandlerRequest,
  IStaticSnapRpcRequestHandler,
} from './rpcs';
import { CreateAccountHandler } from './rpcs';
import { GetBalanceHandler } from './rpcs/methods/get-balance';

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
    case 'bitcoin_getBalance':
      return GetBalanceHandler;
    default:
      throw new SnapError(`Method not found`);
  }
};

export const onRpcRequest: OnRpcRequestHandler = async (args) => {
  const { request, origin } = args;

  logger.logLevel = LogLevel.ALL;

  await validateOrigin(origin);

  const { method } = request;

  const handler = getHandler(method);

  return await handler
    .getInstance()
    .execute(request.params as SnapRpcRequestHandlerRequest);
};
