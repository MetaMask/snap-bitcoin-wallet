import type { KeyringAccount } from '@metamask/keyring-api';
import { type Json } from '@metamask/snaps-sdk';
import type { Infer } from 'superstruct';
import { object } from 'superstruct';

import type { IStaticSnapRpcHandler } from '../libs/rpc';
import { scopeStruct } from '../utils';

export type Wallet = {
  account: KeyringAccount;
  hdPath: string;
  index: number;
  scope: string;
};

export type Wallets = Record<string, Wallet>;

export type SnapState = {
  walletIds: string[];
  wallets: Wallets;
};

export type KeyringOptions = Record<string, Json> & {
  defaultIndex: number;
  multiAccount?: boolean;
  // TODO: Remove temp solution to support keyring in snap without keyring API
  emitEvents?: boolean;
};

export type ChainRPCHandlers = Record<string, IStaticSnapRpcHandler>;

export const CreateAccountOptionsStruct = object({
  scope: scopeStruct,
});

export type CreateAccountOptions = Record<string, Json> &
  Infer<typeof CreateAccountOptionsStruct>;
