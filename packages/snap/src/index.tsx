import { handleKeyringRequest } from '@metamask/keyring-api';
import {
  type OnRpcRequestHandler,
  type OnKeyringRequestHandler,
  type OnUserInputHandler,
  type Json,
  UnauthorizedError,
  SnapError,
  MethodNotFoundError,
} from '@metamask/snaps-sdk';
import {
  SnapWallet,
  KeychainKind,
  Network,
  AddressType,
  slip10_to_extended,
} from '@dario_nakamoto/bdk';

import { Config } from './config';
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
import {
  isSendFormEvent,
  SendBitcoinController,
} from './ui/controller/send-bitcoin-controller';
import type { SendFlowContext, SendFormState } from './ui/types';
import { getBip32Deriver, getStateData, isSnapRpcError, logger } from './utils';

const PARALLEL_REQUESTS = 1;
const STOP_GAP = 5;

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
      case InternalRpcMethod.StartSendTransactionFlow: {
        return await startSendTransactionFlow(
          request.params as StartSendTransactionFlowParams,
        );
      }

      case InternalRpcMethod.CreateWallet: {
        const params = request.params as any;
        const addressTypeToPurpose = {
          [AddressType.P2pkh]: "44'",
          [AddressType.P2sh]: "49'",
          [AddressType.P2wpkh]: "84'",
          [AddressType.P2tr]: "86'",
        };

        const networkToCoinType = {
          [Network.Bitcoin]: "0'",
          [Network.Testnet]: "1'",
          [Network.Testnet4]: "1'",
          [Network.Signet]: "1'",
          [Network.Regtest]: "1'",
        };

        const derivationPath = [
          'm',
          addressTypeToPurpose[params.addressType as AddressType],
          networkToCoinType[params.network as Network],
          "0'",
        ];

        const slip10 = await getBip32Deriver(derivationPath, 'secp256k1');
        const xpriv = slip10_to_extended(slip10, params.network);

        const wallet = await SnapWallet.from_xpriv(
          xpriv,
          slip10.masterFingerprint!.toString(16),
          params.network,
          params.addressType,
          params.provider,
        );

        return wallet.network();
      }

      case InternalRpcMethod.LoadWallet: {
        const params = request.params as any;
        const wallet = await SnapWallet.load(params.provider);

        return wallet.network();
      }

      case InternalRpcMethod.FullScan: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        await wallet.full_scan(STOP_GAP, PARALLEL_REQUESTS);
        await wallet.persist();

        return true;
      }

      case InternalRpcMethod.Sync: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        await wallet.sync(PARALLEL_REQUESTS);
        await wallet.persist();

        return true;
      }

      case InternalRpcMethod.GetState: {
        return await getStateData();
      }

      case InternalRpcMethod.GetBalance: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);

        const balance = wallet.balance();
        return {
          immature: balance.immature.toString(),
          confirmed: balance.confirmed.toString(),
          trusted_pending: balance.trusted_pending.toString(),
          untrusted_pending: balance.untrusted_pending.toString(),
          trusted_spendable: balance.trusted_spendable.toString(),
          total: balance.total.toString(),
        };
      }

      case InternalRpcMethod.Sync: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        await wallet.sync(PARALLEL_REQUESTS);
        await wallet.persist();

        return true;
      }

      case InternalRpcMethod.GetNextUnusedAddress: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        const address = wallet.next_unused_address(KeychainKind.External);

        return {
          address: address.address,
          index: address.index,
          keychain: address.keychain,
        };
      }

      case InternalRpcMethod.RevealNextAddress: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        const address = wallet.reveal_next_address(KeychainKind.External);
        await wallet.persist();

        return {
          address: address.address,
          index: address.index,
          keychain: address.keychain,
        };
      }

      case InternalRpcMethod.PeekAddress: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        const address = wallet.peek_address(
          KeychainKind.External,
          params.index,
        );

        return {
          address: address.address,
          index: address.index,
          keychain: address.keychain,
        };
      }

      case InternalRpcMethod.ListUnusedAddresses: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        const addresses = wallet.list_unused_addresses(KeychainKind.External);

        return addresses.map((address) => ({
          address: address.address,
          index: address.index,
          keychain: address.keychain,
        }));
      }

      case InternalRpcMethod.ListUnspentOutputs: {
        const params = request.params as any;

        const wallet = await SnapWallet.load(params.provider);
        const outputs = wallet.list_unspent();

        return outputs.map((output) => ({
          ...output,
        }));
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

export const onUserInput: OnUserInputHandler = async ({
  id,
  event,
  context,
}) => {
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
