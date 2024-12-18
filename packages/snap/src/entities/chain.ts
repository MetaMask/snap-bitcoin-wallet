import type { BitcoinAccount } from './account';

export type BlockchainClient = {
  /**
   * Perform a full scan operation on the account.
   * Note that this operation modifies the account in place.
   * @param account - the account to full scan.
   */
  fullScan(account: BitcoinAccount): Promise<void>;

  /**
   * Perform a sync operation on the account.
   * Note that this operation modifies the account in place.
   * @param account - the account to sync.
   */
  sync(account: BitcoinAccount): Promise<void>;
};
