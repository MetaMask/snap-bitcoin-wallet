import type { Keyring } from '@metamask/keyring-api';
import { handleKeyringRequest } from '@metamask/keyring-snap-sdk';
import type { OnCronjobHandler, OnInstallHandler } from '@metamask/snaps-sdk';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type OnUserInputHandler,
  type Json,
  UnauthorizedError,
  SnapError,
  MethodNotFoundError,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import { ConfigV2 } from './configv2';
import {
  KeyringHandler,
  CronHandler,
  UserInputHandler,
  RpcHandler,
} from './handlers';
import { SnapClientAdapter, EsploraClientAdapter } from './infra';
import { SimpleHashClientAdapter } from './infra/SimpleHashClientAdapter';
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
import type { StartSendTransactionFlowParams } from './rpcs/start-send-transaction-flow';
import { startSendTransactionFlow } from './rpcs/start-send-transaction-flow';
import { KeyringStateManager } from './stateManagement';
import { BdkAccountRepository, JSXSendFlowRepository } from './store';
import {
  isSendFormEvent,
  SendBitcoinController,
} from './ui/controller/send-bitcoin-controller';
import type { SendFlowContext, SendFormState } from './ui/types';
import { AccountUseCases, SendFlowUseCases } from './use-cases';
import { isSnapRpcError, logger } from './utils';
import { loadLocale } from './utils/locale';

logger.logLevel = parseInt(Config.logLevel, 10);

let keyringHandler: Keyring;
let cronHandler: CronHandler;
let rpcHandler: RpcHandler;
let userInputHandler: UserInputHandler;
let accountsUseCases: AccountUseCases;
if (ConfigV2.keyringVersion === 'v2') {
  // Infra layer
  const snapClient = new SnapClientAdapter(ConfigV2.encrypt);
  const chainClient = new EsploraClientAdapter(ConfigV2.chain);
  const metaProtocolsClient = new SimpleHashClientAdapter(ConfigV2.simpleHash);
  // Data layer
  const accountRepository = new BdkAccountRepository(snapClient);
  const sendFlowRepository = new JSXSendFlowRepository(snapClient);

  // Business layer
  accountsUseCases = new AccountUseCases(
    snapClient,
    accountRepository,
    chainClient,
    metaProtocolsClient,
    ConfigV2.accounts,
  );
  const sendFlowUseCases = new SendFlowUseCases(
    snapClient,
    accountRepository,
    sendFlowRepository,
    chainClient,
    ConfigV2.targetBlocksConfirmation,
    ConfigV2.fallbackFeeRate,
  );
  // Application layer
  keyringHandler = new KeyringHandler(accountsUseCases);
  cronHandler = new CronHandler(accountsUseCases);
  rpcHandler = new RpcHandler(sendFlowUseCases, accountsUseCases);
  userInputHandler = new UserInputHandler(sendFlowUseCases);
}

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
    // No need for a handler given the lack of request
    if (accountsUseCases) {
      await accountsUseCases.create(
        ConfigV2.accounts.defaultNetwork,
        ConfigV2.accounts.defaultAddressType,
      );
    }
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
    if (cronHandler) {
      await cronHandler.route(request.method);
    }
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

    if (rpcHandler) {
      return await rpcHandler.route(method, request.params);
    }

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
      case InternalRpcMethod.StartSendTransactionFlow: {
        return await startSendTransactionFlow(
          request.params as StartSendTransactionFlowParams,
        );
      }

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
  await loadLocale();

  try {
    validateOrigin(origin, request.method);

    if (!keyringHandler) {
      keyringHandler = new BtcKeyring(new KeyringStateManager(), {
        defaultIndex: Config.wallet.defaultAccountIndex,
        origin,
      });
    }

    return (await handleKeyringRequest(
      keyringHandler,
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
  await loadLocale();

  try {
    if (!userInputHandler) {
      const state = await snap.request({
        method: 'snap_getInterfaceState',
        params: { id },
      });

      if (isSendFormEvent(event)) {
        const sendBitcoinController = new SendBitcoinController({
          context: context as SendFlowContext,
          interfaceId: id,
        });
        return await sendBitcoinController.handleEvent(
          event,
          context as SendFlowContext,
          state.sendForm as SendFormState,
        );
      }
    }

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
