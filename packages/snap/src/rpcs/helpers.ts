import { SnapRpcError } from './exceptions';
import { CreateAccountHandler, GetBalancesHandler } from './methods';
import type { IStaticSnapRpcHandler } from './types';

export class RpcHelper {
  static getChainApiHandler(method: string): IStaticSnapRpcHandler {
    switch (method) {
      case 'chain_createAccount':
        return CreateAccountHandler;
      case 'chain_getBalances':
        return GetBalancesHandler;
      default:
        throw new SnapRpcError(`Method not found`);
    }
  }
}
