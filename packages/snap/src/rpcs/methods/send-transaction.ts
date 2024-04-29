import { object, string, assign, type Infer, record } from 'superstruct';

import type { StaticImplements } from '../../types/static';
import { numberStringStruct } from '../../utils';
import { BaseSnapRpcHandler } from '../base';
import {
  SnapRpcHandlerRequestStruct,
  type IStaticSnapRpcHandler,
  type SnapRpcHandlerResponse,
} from '../types';

export type SendTransactionParams = Infer<
  typeof SendTransactionHandler.requestStruct
>;

export type SendTransactionResponse = SnapRpcHandlerResponse;

export class SendTransactionHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof SendTransactionHandler>
{
  static override get requestStruct() {
    return assign(
      object({
        account: string(),
        intent: object({
          amounts: record(string(), numberStringStruct),
        }),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  async handleRequest(
    /* eslint-disable */
    params: SendTransactionParams,
    /* eslint-disable */
  ): Promise<SendTransactionResponse> {
    throw new Error('Method not implemented');
    // const { scope, account: address, intent } = params;
    // const transactionIntent: TransactionIntent = Object.entries(
    //   intent.amounts,
    // ).reduce(
    //   (acc, [account, amount]) => {
    //     acc.amounts[account] = parseInt(amount, 10); // assume satoshi
    //     return acc;
    //   },
    //   { amounts: {} },
    // );

    // // TODO: Get account by address or pass account object from Keyring
    // const accountMgr = Factory.createAccountMgr(Config.chain, scope);
    // const account = await accountMgr.unlock(0);
    // if (!account || account.address !== address) {
    //   throw new Error('Account not found');
    // }

    // const chainApi = Factory.createTransactionMgr(Config.chain, scope);

    // const feesResp = await chainApi.estimateFees();

    // const fee = await this.getFeeConsensus(feesResp);

    // const data = await chainApi.getDataForTransaction(
    //   address,
    //   transactionIntent,
    // );

    // const { txn, txnJson } = await accountMgr.createTransaction(
    //   account,
    //   transactionIntent,
    //   {
    //     metadata: data,
    //     fee,
    //   },
    // );

    // if ((await this.getTxnConsensus(txnJson)) === false) {
    //   throw new UserRejectedRequestError();
    // }

    // const txnHash = await account.signTransaction(txn);

    // return await chainApi.boardcastTransaction(txnHash);
  }

  // protected async getFeeConsensus(fees: Fees): Promise<number> {
  //   // TODO: Ask user to confirm fee
  //   return fees.fees[0].rate;
  // }

  // protected async getTxnConsensus(
  //   txnJson: Record<string, Json>,
  // ): Promise<boolean> {
  //   // TODO: Ask user to confirm txn
  //   return true;
  // }
}
