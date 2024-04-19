import type { KeyringAccount } from '@metamask/keyring-api';


export type Wallet = {
  account: KeyringAccount;
  type: string;
  index: number;
  scope: string;
};

export type Wallets = Record<string, Wallet>;

export type SnapState = {
  accounts: string[];
  wallets: Wallets;
};
