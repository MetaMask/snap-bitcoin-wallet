import { MethodNotFoundError } from '@metamask/snaps-sdk';

import {
  CreateAccountHandler,
  EstimateFeesHandler,
  GetBalancesHandler,
} from './methods';
import type { IStaticSnapRpcHandler } from './types';

export class RpcHelper {
  static getChainApiHandler(method: string): IStaticSnapRpcHandler {
    switch (method) {
      case 'chain_createAccount':
        return CreateAccountHandler;
      case 'chain_getBalances':
        return GetBalancesHandler;
      case 'chain_estimateFees':
        return EstimateFeesHandler;
      default:
        throw new MethodNotFoundError() as unknown as Error;
    }
  }
}
