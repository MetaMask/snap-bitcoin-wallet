import type { KeyringAccount } from '@metamask/keyring-api';

export type SnapState = {
  accounts: string[];
  accountDetails: Record<string, KeyringAccount>;
};
