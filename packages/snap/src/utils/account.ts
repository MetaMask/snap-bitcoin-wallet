import type { KeyringAccount } from '@metamask/keyring-api';

import type { BtcAccount } from '../bitcoin/wallet';
import { AccountNotFoundError } from '../exceptions';

/**
 * Verifies if the provided BtcAccount object and KeyringAccount object are valid and the address is consistent.
 *
 * @param account - The BtcAccount object to verify.
 * @param keyringAccount - The KeyringAccount object to verify.
 * @throws {AccountNotFoundError} If either the BtcAccount object or the KeyringAccount object is not provided.
 * @throws {AccountNotFoundError} If the BtcAccount's address and the KeyringAccount's adderss is inconsistent.
 */
export function verifyIfAccountValid(
  account: BtcAccount,
  keyringAccount: KeyringAccount,
): void {
  if (!account || !keyringAccount) {
    throw new AccountNotFoundError();
  }
  // Make sure the BtcAccount's address is consistent with the state data, if not, then either the state has been corrupted or
  // the derivation scheme changed (which should not happen without an explicit migration of the state)
  if (account.address !== keyringAccount.address) {
    throw new AccountNotFoundError('Inconsistent account found');
  }
}
