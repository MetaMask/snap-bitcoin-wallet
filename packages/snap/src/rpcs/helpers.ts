import { CreateAccountHandler } from '.';
import type { IStaticSnapRpcHandler } from '../libs/rpc';
import { GetTransactionStatusHandler } from './get-transaction-status';
import { SendManyHandler } from './sendmany';

export class RpcHelper {
  static getChainRpcApiHandlers(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_createAccount: CreateAccountHandler,
      // // eslint-disable-next-line @typescript-eslint/naming-convention
      // chain_getBalances: GetBalancesHandler,
      // // eslint-disable-next-line @typescript-eslint/naming-convention
      // chain_broadcastTransaction: BroadcastTransactionHandler,
      // // eslint-disable-next-line @typescript-eslint/naming-convention
      // chain_getDataForTransaction: GetTransactionDataHandler,
      // // eslint-disable-next-line @typescript-eslint/naming-convention
      // chain_estimateFees: EstimateFeesHandler,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_getTransactionStatus: GetTransactionStatusHandler,
    };
  }

  static getKeyringRpcApiHandlers(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendmany: SendManyHandler,
    };
  }
}
