import type {
  FeeEstimates,
  Network,
  Transaction,
} from '@bitcoindevkit/bdk-wallet-web';

import type { BitcoinAccount } from './account';

export const BlockTime: Record<Network, number> = {
  bitcoin: 10,
  testnet: 10,
  testnet4: 10,
  signet: 0.5,
  regtest: 0.5,
};

export type BlockchainClient = {
  /**
   * Perform a full scan operation on the account.
   * Note that this operation modifies the account in place.
   *
   * @param account - the account to full scan.
   */
  fullScan(account: BitcoinAccount): Promise<void>;

  /**
   * Perform a sync operation on the account.
   * Note that this operation modifies the account in place.
   *
   * @param account - the account to sync.
   */
  sync(account: BitcoinAccount): Promise<void>;

  /**
   * Broadcast the signed transaction to the network.
   *
   * @param network - Network where the signed transaction will be broadcasted.
   * @param transaction - Transaction to broadcast.
   */
  broadcast(network: Network, transaction: Transaction): Promise<void>;

  /**
   * Fetch fee estimates from the chain indexer.
   *
   * @param network - Network to fetch the fees from.
   * @returns the map of fee estimates
   */
  getFeeEstimates(network: Network): Promise<FeeEstimates>;

  /**
   * Returns the explorer url for the given network.
   *
   * @param network - Network.
   * @returns the base url of the explorer
   */
  getExplorerUrl(network: Network): string;
};
