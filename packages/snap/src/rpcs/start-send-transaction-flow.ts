import { UserRejectedRequestError } from '@metamask/snaps-sdk';

import type { Caip2ChainId } from '../constants';
import { AccountNotFoundError } from '../exceptions';
import { Factory } from '../factory';
import { KeyringStateManager, TransactionStatus } from '../stateManagement';
import { generateSendFlow, updateSendFlow } from '../ui/render-interfaces';
import {
  convertBtcToFiat,
  getAssetTypeFromScope,
  generateSendManyParams,
} from '../ui/utils';
import { logger, verifyIfAccountValid } from '../utils';
import { getRates } from '../utils/rates';
import { getBalances } from './get-balances';
import { sendMany } from './sendmany';

export type StartSendTransactionFlowParams = {
  account: string;
  scope: Caip2ChainId;
};

/**
 * Starts the send transaction flow for a given account and scope.
 *
 * @param options0 - The options for starting the send transaction flow.
 * @param options0.account - The ID of the account to use.
 * @param options0.scope - The scope of the transaction.
 * @returns The transaction result.
 */
export async function startSendTransactionFlow({
  account,
  scope,
}: StartSendTransactionFlowParams) {
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

    await stateManager.upsertRequest(sendFlowRequest);

    // This awaited later on the flow inorder to display the ui as soon as possible.
    // If we don't, then the UI will be displayed after the balances and rates call are finished.
    const sendFlowPromise = snap.request({
      method: 'snap_dialog',
      params: {
        id: sendFlowRequest.interfaceId,
      },
    });

    const balances = await getBalances(btcAccount, {
      assets: [asset],
      scope,
    });

    // mock rates call
    const rates = await getRates(asset);

    sendFlowRequest.balance.amount = balances[asset].amount;
    sendFlowRequest.balance.fiat = convertBtcToFiat(
      balances[asset].amount,
      rates,
    );
    sendFlowRequest.rates = rates;
    await stateManager.upsertRequest(sendFlowRequest);

    await updateSendFlow({
      request: {
        ...sendFlowRequest,
      },
    });

    const sendFlowResult = await sendFlowPromise;

    if (!sendFlowResult) {
      sendFlowRequest.status = TransactionStatus.Rejected;
      await stateManager.removeRequest(sendFlowRequest.id);
      throw new UserRejectedRequestError() as unknown as Error;
    }

    // Get the latest send flow request from the state manager
    // this has been updated via onInputHandler
    const updatedSendFlowRequest = await stateManager.getRequest(
      sendFlowRequest.id,
    );

    if (!updatedSendFlowRequest) {
      throw new Error('Send flow request not found');
    }

    const sendManyParams = generateSendManyParams(
      walletData.scope,
      updatedSendFlowRequest,
    );
    sendFlowRequest.transaction = sendManyParams;
    sendFlowRequest.status = TransactionStatus.Confirmed;
    await stateManager.upsertRequest(sendFlowRequest);

    const tx = await sendMany(btcAccount, scope, {
      ...sendFlowRequest.transaction,
      scope,
    });

    sendFlowRequest.txId = tx.txId;
    await stateManager.upsertRequest(sendFlowRequest);
    return tx;
  } catch (error) {
    logger.error('Failed to start send transaction flow', error);

    throw new Error(error);
  }
}
