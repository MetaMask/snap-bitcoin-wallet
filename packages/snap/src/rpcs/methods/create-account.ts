import type { KeyringAccount } from '@metamask/keyring-api';
import type { Infer } from 'superstruct';
import { object, number, assign } from 'superstruct';

import { Config } from '../../modules/config';
import { Factory } from '../../modules/factory';
import { BtcKeyring, KeyringStateManager } from '../../modules/keyring';
import type { StaticImplements } from '../../types/static';
import { BaseSnapRpcHandler } from '../base';
import type { IStaticSnapRpcHandler, SnapRpcHandlerResponse } from '../types';
import { SnapRpcHandlerRequestStruct } from '../types';

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
    return assign(
      object({
        index: number(),
      }),
      SnapRpcHandlerRequestStruct,
    );
  }

  requestStruct = CreateAccountHandler.requestStruct;

  async handleRequest(
    params: CreateAccountParams,
  ): Promise<CreateAccountResponse> {
    const keyring = new BtcKeyring(
      new KeyringStateManager(),
      Factory.createBtcChainRpcMapping(),
      {
        defaultIndex: Config.account[Config.chain].defaultAccountIndex,
        multiAccount: Config.account[Config.chain].enableMultiAccounts,
        emitEvents: false,
      },
    );

    const account = await keyring.createAccount({
      scope: params.scope,
    });

    return account;
  }
}
