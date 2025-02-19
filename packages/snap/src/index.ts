import { handleKeyringRequest } from '@metamask/keyring-snap-sdk';
import type { OnCronjobHandler, OnInstallHandler } from '@metamask/snaps-sdk';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type OnUserInputHandler,
  type Json,
  UnauthorizedError,
  SnapError,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import { isSnapRpcError, loadLocale } from './entities';
import {
  KeyringHandler,
  CronHandler,
  UserInputHandler,
  RpcHandler,
} from './handlers';
import {
  SnapClientAdapter,
  EsploraClientAdapter,
  SimplehashClientAdapter,
  logger,
} from './infra';
import { originPermissions } from './permissions';
import { BdkAccountRepository, JSXSendFlowRepository } from './store';
import { AccountUseCases, SendFlowUseCases } from './use-cases';

// Infra layer
logger.logLevel = parseInt(Config.logLevel, 10);
const snapClient = new SnapClientAdapter(Config.encrypt);
const chainClient = new EsploraClientAdapter(Config.chain);
const metaProtocolsClient = new SimplehashClientAdapter(Config.simplehash);
// Data layer
const accountRepository = new BdkAccountRepository(snapClient);
const sendFlowRepository = new JSXSendFlowRepository(snapClient);

// Business layer
const accountsUseCases = new AccountUseCases(
  snapClient,
  accountRepository,
  chainClient,
  metaProtocolsClient,
  Config.accounts,
);
const sendFlowUseCases = new SendFlowUseCases(
  snapClient,
  accountRepository,
  sendFlowRepository,
  chainClient,
  Config.targetBlocksConfirmation,
  Config.fallbackFeeRate,
);
// Application layer
const keyringHandler = new KeyringHandler(accountsUseCases);
const cronHandler = new CronHandler(accountsUseCases);
const rpcHandler = new RpcHandler(sendFlowUseCases, accountsUseCases);
const userInputHandler = new UserInputHandler(sendFlowUseCases);

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

export const onInstall: OnInstallHandler = async () => {
  try {
    await accountsUseCases.create(
      Config.accounts.defaultNetwork,
      Config.accounts.defaultAddressType,
    );
  } catch (error) {
    let snapError = error;

    if (!isSnapRpcError(error)) {
      snapError = new SnapError(error);
    }
    logger.error(
      `onInstall error: ${JSON.stringify(snapError.toJSON(), null, 2)}`,
    );
    throw snapError;
  }
};

export const onCronjob: OnCronjobHandler = async ({ request }) => {
  try {
    await cronHandler.route(request.method);
  } catch (error) {
    let snapError = error;

    if (!isSnapRpcError(error)) {
      snapError = new SnapError(error);
    }
    logger.error(
      `onCronjob error: ${JSON.stringify(snapError.toJSON(), null, 2)}`,
    );
    throw snapError;
  }
};

export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}): Promise<Json> => {
  await loadLocale();

  try {
    const { method } = request;
    validateOrigin(origin, method);
    return await rpcHandler.route(method, request.params);
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
  await loadLocale();

  try {
    validateOrigin(origin, request.method);
    return (await handleKeyringRequest(keyringHandler, request)) ?? null;
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
  await loadLocale();

  try {
    return userInputHandler.route(id, event, context);
  } catch (error) {
    let snapError = error;

    if (!isSnapRpcError(error)) {
      snapError = new SnapError(error);
    }
    logger.error(
      `onUserInput error: ${JSON.stringify(snapError.toJSON(), null, 2)}`,
    );
    throw snapError;
  }
};
