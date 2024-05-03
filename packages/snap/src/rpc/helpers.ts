import { MethodNotFoundError } from '@metamask/snaps-sdk';

import { CreateAccountHandler, GetBalancesHandler } from './methods';
import type { IStaticSnapRpcHandler } from './types';

export class RpcHelper {
  static getRpcApiHandler(method: string): IStaticSnapRpcHandler {
    switch (method) {
      case 'chain_createAccount':
        return CreateAccountHandler;
      case 'chain_getBalances':
        return GetBalancesHandler;
      default:
        throw new MethodNotFoundError() as unknown as Error;
    }
  }
}
