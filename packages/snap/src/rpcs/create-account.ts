import type { KeyringAccount } from '@metamask/keyring-api';
import type { Infer } from 'superstruct';

import { Config } from '../config';
import { BtcKeyring, KeyringStateManager } from '../keyring';
import { SnapRpcHandlerRequestStruct, BaseSnapRpcHandler } from '../libs/rpc';
import type {
  IStaticSnapRpcHandler,
  SnapRpcHandlerResponse,
} from '../libs/rpc';
import type { StaticImplements } from '../types/static';

export type CreateAccountParams = Infer<
  typeof CreateAccountHandler.requestStruct
>;

export type CreateAccountResponse = SnapRpcHandlerResponse & KeyringAccount;

export class CreateAccountHandler
  extends BaseSnapRpcHandler
  implements
    StaticImplements<IStaticSnapRpcHandler, typeof CreateAccountHandler>
{
  static override get requestStruct() {
    return SnapRpcHandlerRequestStruct;
  }

  async handleRequest(
    params: CreateAccountParams,
  ): Promise<CreateAccountResponse> {
    const keyring = new BtcKeyring(new KeyringStateManager(), {
      defaultIndex: Config.wallet[Config.chain].defaultAccountIndex,
      multiAccount: Config.wallet[Config.chain].enableMultiAccounts,
      emitEvents: false,
    });

    const account = await keyring.createAccount({
      scope: params.scope,
    });

    return account;
  }
}
