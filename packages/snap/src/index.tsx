import type { Keyring } from '@metamask/keyring-api';
import { handleKeyringRequest } from '@metamask/keyring-snap-sdk';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type OnUserInputHandler,
  type Json,
  SnapError,
} from '@metamask/snaps-sdk';

import { Config } from './config';
import { ConfigV2 } from './configv2';
import { KeyringHandler } from './handlers/KeyringHandler';
import { SnapClientAdapter } from './infra';
import { BtcKeyring } from './keyring';
import { InternalRpcMethod, originPermissions } from './permissions';
import { SnapAccountRepository } from './repositories/SnapAccountRepository';
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
import { BdkAccountRepository } from './store/BdkAccountRepository';
import {
  isSendFormEvent,
  SendBitcoinController,
} from './ui/controller/send-bitcoin-controller';
import type { SendFlowContext, SendFormState } from './ui/types';
import { AccountUseCases } from './usecases';
import { isSnapRpcError, logger } from './utils';
import { loadLocale } from './utils/locale';

logger.logLevel = parseInt(Config.logLevel, 10);

let keyring: Keyring;
if (ConfigV2.keyringVersion === 'v2') {
  // Infra layer
  const store = new SnapClientAdapter(ConfigV2.encrypt);
  // Data layer
  const repository = new BdkAccountRepository(store);
  // Business layer
  const useCases = new AccountUseCases(repository, ConfigV2.accounts.index);
  // Application layer
  keyring = new KeyringHandler(useCases, ConfigV2.accounts);
}

export const validateOrigin = (origin: string, method: string): void => {
  if (!origin) {
    throw new Error('Missing origin');
  }

  const permissions = originPermissions.get(origin);
  if (!permissions) {
    throw new Error(`Origin ${origin} not allowed`);
  }

  if (!permissions.has(method)) {
    console.log('permissions', permissions);
    throw new Error(`Permission denied for method: ${method}`);
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
        throw new Error('Method not found');
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

    if (!keyring) {
      keyring = new BtcKeyring(new KeyringStateManager(), {
        defaultIndex: Config.wallet.defaultAccountIndex,
        origin,
      });
    }

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

export const onUserInput: OnUserInputHandler = async ({
  id,
  event,
  context,
}) => {
  await loadLocale();

  const state = await snap.request({
    method: 'snap_getInterfaceState',
    params: { id },
  });

  if (isSendFormEvent(event)) {
    const sendBitcoinController = new SendBitcoinController({
      context: context as SendFlowContext,
      interfaceId: id,
    });
    await sendBitcoinController.handleEvent(
      event,
      context as SendFlowContext,
      state.sendForm as SendFormState,
    );
  }
};
