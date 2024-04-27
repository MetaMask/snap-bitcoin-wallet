import { object, string, assign, type Infer, record } from 'superstruct';

/* eslint-disable */
import { Config } from '../../config';
import type { TransactionIntent } from '../../modules/chain/types';
import { Factory } from '../../modules/factory';
/* eslint-disable */
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: SendTransactionParams,
  ): Promise<SendTransactionResponse> {
    throw new Error('Method not implemented.');
    // const { scope, account: address, intent } = params;
    // /* eslint-disable */
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

    // // TODO: Ask user to confirm fee
    // const fee = feesResp.fees[0].rate;

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

    // // TODO: Create dailog with txnJson, and ask user to confirm txn
    // const txnHash = await account.signTransaction(txn);

    // return await chainApi.boardcastTransaction(txnHash);
    /* eslint-disable */
  }
}
