import { CreateAccountHandler, GetBalancesHandler } from '.';
import type { IStaticSnapRpcHandler } from '../modules/rpc';
import { BroadcastTransactionHandler } from './broadcast-transaction';
import { EstimateFeesHandler } from './estimate-fees';
import { GetTransactionDataHandler } from './get-transaction-data';
import { SendManyHandler } from './sendmany';

export class RpcHelper {
  static getChainRpcApiHandlers(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_createAccount: CreateAccountHandler,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_getBalances: GetBalancesHandler,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_broadcastTransaction: BroadcastTransactionHandler,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_getDataForTransaction: GetTransactionDataHandler,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_estimateFees: EstimateFeesHandler,
    };
  }

  static getKeyringRpcApiHandlers(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendmany: SendManyHandler,
    };
  }
}
