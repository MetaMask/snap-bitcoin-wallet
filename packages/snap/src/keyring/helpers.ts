import { SendManyHandler } from '../rpc';
import type { ChainRPCHandlers } from './types';

export class KeyringHelper {
  static getRpcApiHandlers(): ChainRPCHandlers {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      btc_sendmany: SendManyHandler,
    };
  }
}
