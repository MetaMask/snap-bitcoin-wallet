import { UserRejectedRequestError } from '@metamask/snaps-sdk';
import { enums, nonempty, object, string } from 'superstruct';

import { TxValidationError } from '../bitcoin/wallet';
import { Caip2ChainId } from '../constants';
import { AccountNotFoundError, isSnapException } from '../exceptions';
import { Factory } from '../factory';
import type { SendFlowRequest } from '../stateManagement';
import { KeyringStateManager, TransactionStatus } from '../stateManagement';
import { generateSendFlow, updateSendFlow } from '../ui/render-interfaces';
import {
  btcToFiat,
  getAssetTypeFromScope,
  generateSendBitcoinParams,
} from '../ui/utils';
import {
  createSendUIDialog,
  isSnapRpcError,
  logger,
  validateRequest,
  verifyIfAccountValid,
} from '../utils';
import { createRatesAndBalances } from './get-rates-and-balances';
import { sendBitcoin } from './send-bitcoin';

export type StartSendTransactionFlowParams = {
  account: string;
  scope: Caip2ChainId;
};

export const StartSendTransactionFlowParamsStruct = object({
  account: nonempty(string()),
  scope: enums([...Object.values(Caip2ChainId)]),
});

/**
 * Starts the send transaction flow for a given account and scope.
 *
 * @param params - The parameters for starting the transaction flow.
 * @returns The transaction result.
 */
export async function startSendTransactionFlow(
  params: StartSendTransactionFlowParams,
) {
  validateRequest<StartSendTransactionFlowParams>(
    params,
    StartSendTransactionFlowParamsStruct,
  );
  const { account, scope } = params;
  try {
    const stateManager = new KeyringStateManager();
    const walletData = await stateManager.getWallet(account);

    if (!walletData) {
      throw new AccountNotFoundError();
    }

    const wallet = Factory.createWallet(walletData.scope);
    const btcAccount = await wallet.unlock(
      walletData.index,
      walletData.account.type,
    );
    verifyIfAccountValid(btcAccount, walletData.account);

    const asset = getAssetTypeFromScope(scope);

    const sendFlowRequest = await generateSendFlow({
      account: walletData.account,
      scope,
    });

    // This will be awaited later on the flow in order to display the UI as soon as possible.
    // If we don't, then the UI will be displayed after the balances and rates call are finished.
    const sendFlowPromise = createSendUIDialog(sendFlowRequest.interfaceId);

    const { rates, balances } = await createRatesAndBalances({
      asset,
      scope,
      btcAccount,
    });

    const errors: string[] = [];

    if (rates.error) {
      errors.push(rates.error);
    }

    if (balances.error) {
      errors.push(balances.error);
    }

    if (errors.length > 0) {
      throw new Error(`Error fetching rates and balances: ${errors.join(',')}`);
    }

    sendFlowRequest.balance.amount = balances.value;
    sendFlowRequest.balance.fiat = btcToFiat(balances.value, rates.value);
    sendFlowRequest.rates = rates.value;

    await updateSendFlow({
      request: {
        ...sendFlowRequest,
      },
    });

    // The dialog resolves into the send flow request that has been confirmed by the user
    const updatedSendFlowRequest = (await sendFlowPromise) as SendFlowRequest;

    if (updatedSendFlowRequest.status === TransactionStatus.Rejected) {
      throw new UserRejectedRequestError() as unknown as Error;
    }

    const sendBitcoinParams = generateSendBitcoinParams(
      walletData.scope,
      updatedSendFlowRequest,
    );
    updatedSendFlowRequest.transaction = sendBitcoinParams;
    updatedSendFlowRequest.status = TransactionStatus.Confirmed;

    const tx = await sendBitcoin(btcAccount, scope, {
      ...updatedSendFlowRequest.transaction,
      scope,
    });

    updatedSendFlowRequest.txId = tx.txId;

    await stateManager.upsertRequest(updatedSendFlowRequest);
    return tx;
  } catch (error) {
    logger.error('Failed to start send transaction flow', error);

    if (isSnapRpcError(error)) {
      throw error as unknown as Error;
    }

    if (isSnapException(error) || error instanceof TxValidationError) {
      throw error;
    }

    throw new Error('Failed to send the transaction');
  }
}
