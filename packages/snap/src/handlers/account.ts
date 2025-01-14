import type { KeyringAccount } from '@metamask/keyring-api';
import { BtcMethod } from '@metamask/keyring-api';

import type { BitcoinAccount } from '../entities';
import { addressTypeToCaip2, networkToCaip2 } from './caip2';

/**
 * Maps a Bitcoin Account to a Keyring Account.
 * @param account - The Bitcoin account.
 * @returns The Keyring account.
 */
export function snapToKeyringAccount(account: BitcoinAccount): KeyringAccount {
  return {
    type: addressTypeToCaip2[account.addressType] as KeyringAccount['type'],
    scopes: [networkToCaip2[account.network]],
    id: account.id,
    address: account.nextUnusedAddress().address,
    options: {},
    methods: [BtcMethod.SendBitcoin],
  };
}
