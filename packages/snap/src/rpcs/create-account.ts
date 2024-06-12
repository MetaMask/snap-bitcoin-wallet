import type { KeyringAccount } from '@metamask/keyring-api';
import { object, type Infer } from 'superstruct';

import { Config } from '../config';
import { BtcKeyring } from '../keyring';
import { KeyringStateManager } from '../stateManagement';
import { scopeStruct } from '../utils';

export const CreateAccountParamsStruct = object({
  scope: scopeStruct,
});

export type CreateAccountParams = Infer<typeof CreateAccountParamsStruct>;

export type CreateAccountResponse = KeyringAccount;

/**
 * Creates a new account with the specified parameters.
 *
 * @param params - The parameters for creating the account.
 * @returns A Promise that resolves to the new account.
 */
export async function createAccount(
  params: CreateAccountParams,
): Promise<CreateAccountResponse> {
  const keyring = new BtcKeyring(new KeyringStateManager(), {
    defaultIndex: Config.wallet.defaultAccountIndex,
    emitEvents: false,
  });

  const account = await keyring.createAccount({
    scope: params.scope,
  });

  return account;
}
