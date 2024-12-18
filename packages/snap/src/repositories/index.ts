import type { AddressType, Network } from 'bitcoindevkit';

import type { BitcoinAccount } from '../entities';

/**
 * AccountRepository is a repository that manages Bitcoin accounts.
 */
export type AccountRepository = {
  /**
   * Get an account by its id.
   * @param id
   * @returns the account or null if it does not exist
   */
  get(id: string): Promise<BitcoinAccount | null>;

  /**
   * Get an account by its derivation path.
   * @param derivationPath
   * @returns the account or null if it does not exist
   */
  getByDerivationPath(derivationPath: string[]): Promise<BitcoinAccount | null>;

  /**
   * Insert a new account.
   * @param derivationPath
   * @param network
   * @param addressType
   * @returns the new account
   */
  insert(
    derivationPath: string[],
    network: Network,
    addressType: AddressType,
  ): Promise<BitcoinAccount>;
};
