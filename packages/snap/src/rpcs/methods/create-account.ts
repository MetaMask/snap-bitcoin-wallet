import type { KeyringAccount } from '@metamask/keyring-api';
import type { Infer } from 'superstruct';
import { object, number, assign } from 'superstruct';

import { Chain } from '../../modules/config';
import { Factory } from '../../modules/factory';
import type { StaticImplements } from '../../types/static';
import { BaseSnapRpcRequestHandler } from '../base';
import type {
  IStaticSnapRpcRequestHandler,
  SnapRpcRequestHandlerResponse,
} from '../types';
import { SnapRpcRequestHandlerRequestStruct } from '../types';

export type CreateAccountParams = Infer<
  typeof CreateAccountHandler.validateStruct
>;

export type CreateAccountResponse = SnapRpcRequestHandlerResponse &
  KeyringAccount;

export class CreateAccountHandler
  extends BaseSnapRpcRequestHandler
  implements
    StaticImplements<IStaticSnapRpcRequestHandler, typeof CreateAccountHandler>
{
  static get validateStruct() {
    return assign(
      object({
        index: number(),
      }),
      SnapRpcRequestHandlerRequestStruct,
    );
  }

  validateStruct = CreateAccountHandler.validateStruct;

  async handleRequest(
    params: CreateAccountParams,
  ): Promise<CreateAccountResponse> {
    const keyring = Factory.createKeyring(Chain.Bitcoin, params.scope);

    const account = await keyring.createAccount({
      scope: params.scope,
    });

    return account;
  }
}
