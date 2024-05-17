import { CreateAccountHandler, GetBalancesHandler } from '.';
import type { IStaticSnapRpcHandler } from '../modules/rpc';
import { SendManyHandler } from './sendmany';

export class RpcHelper {
  static getChainRpcApiHandlers(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_createAccount: CreateAccountHandler,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      chain_getBalances: GetBalancesHandler,
    };
  }

  static getKeyringRpcApiHandlers(): Record<string, IStaticSnapRpcHandler> {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendmany: SendManyHandler,
    };
  }
}
