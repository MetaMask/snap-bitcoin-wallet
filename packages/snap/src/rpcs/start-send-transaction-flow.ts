import type { Caip2ChainId } from '../constants';
import { AccountNotFoundError } from '../exceptions';
import { Factory } from '../factory';
import { KeyringStateManager, TransactionStatus } from '../stateManagement';
import { generateSendFlow, updateSendFlow } from '../ui/render-interfaces';
import {
  convertBtcToFiat,
  getAssetTypeFromScope,
  sendStateToSendManyParams,
} from '../ui/utils';
import { logger } from '../utils';
import { getBalances } from './get-balances';
import { sendMany } from './sendmany';

export type StartSendTransactionFlowParams = {
  accountId: string;
  scope: Caip2ChainId;
};

/**
 * Starts the send transaction flow for a given account and scope.
 *
 * @param options0 - The options for starting the send transaction flow.
 * @param options0.accountId - The ID of the account to use.
 * @param options0.scope - The scope of the transaction.
 * @returns The transaction result.
 */
export async function startSendTransactionFlow({
  accountId,
  scope,
}: StartSendTransactionFlowParams) {
  try {
    const stateManager = new KeyringStateManager();
    const walletData = await stateManager.getWallet(accountId);

    if (!walletData) {
      throw new AccountNotFoundError();
    }

    const wallet = Factory.createWallet(walletData.scope);

    const account = await wallet.unlock(
      walletData.index,
      walletData.account.type,
    );
    const asset = getAssetTypeFromScope(scope);

    const sendFlowRequest = await generateSendFlow({
      account: walletData.account,
      scope,
    });

    await stateManager.upsertRequest(sendFlowRequest);

    const sendFlowPromise = snap.request({
      method: 'snap_dialog',
      params: {
        id: sendFlowRequest.interfaceId,
      },
    });

    const balances = await getBalances(account, {
      assets: [asset],
      scope,
    });

    // mock rates call
    const rates = '64000';

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
      await stateManager.upsertRequest(sendFlowRequest);
      throw new Error('User rejected the request');
    }

    // Get the latest send flow request from the state manager
    // this has been updated via onInputHandler
    const updatedSendFlowRequest = await stateManager.getRequest(
      sendFlowRequest.id,
    );

    if (!updatedSendFlowRequest) {
      throw new Error('Send flow request not found');
    }

    const sendManyParams = await sendStateToSendManyParams(
      updatedSendFlowRequest,
      walletData.scope,
    );
    sendFlowRequest.transaction = sendManyParams;
    sendFlowRequest.status = TransactionStatus.Confirmed;
    await stateManager.upsertRequest(sendFlowRequest);

    const tx = await sendMany(account, scope, {
      ...sendFlowRequest.transaction,
      scope,
    });

    sendFlowRequest.txId = tx.txId;
    return tx;
  } catch (error) {
    logger.error('Failed to start send transaction flow', error);

    throw new Error(error);
  }
}
