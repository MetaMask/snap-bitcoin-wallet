import type {
  FeeEstimates,
  Network,
  Transaction,
} from '@metamask/bitcoindevkit';
import { EsploraClient } from '@metamask/bitcoindevkit';

import {
  type BitcoinAccount,
  type ChainConfig,
  type BlockchainClient,
  ExternalServiceError,
} from '../entities';

export class EsploraClientAdapter implements BlockchainClient {
  // Should be a Repository but we don't support custom networks so we can save in memory from config values
  readonly #clients: Record<Network, EsploraClient>;

  readonly #config: ChainConfig;

  constructor(config: ChainConfig) {
    this.#clients = {
      bitcoin: new EsploraClient(config.url.bitcoin),
      testnet: new EsploraClient(config.url.testnet),
      testnet4: new EsploraClient(config.url.testnet4),
      signet: new EsploraClient(config.url.signet),
      regtest: new EsploraClient(config.url.regtest),
    };

    this.#config = config;
  }

  async fullScan(account: BitcoinAccount): Promise<void> {
    try {
      const request = account.startFullScan();
      const update = await this.#clients[account.network].full_scan(
        request,
        this.#config.stopGap,
        this.#config.parallelRequests,
      );
      return account.applyUpdate(update);
    } catch (error) {
      throw new ExternalServiceError(
        `Failed to perform initial full scan`,
        { account: account.id },
        error,
      );
    }
  }

  async sync(account: BitcoinAccount): Promise<void> {
    try {
      const request = account.startSync();
      const update = await this.#clients[account.network].sync(
        request,
        this.#config.parallelRequests,
      );
      return account.applyUpdate(update);
    } catch (error) {
      throw new ExternalServiceError(
        `Failed to synchronize account`,
        { account: account.id },
        error,
      );
    }
  }

  async broadcast(network: Network, transaction: Transaction): Promise<void> {
    try {
      return this.#clients[network].broadcast(transaction);
    } catch (error) {
      throw new ExternalServiceError(
        `Failed to broadcast transaction`,
        { network, txid: transaction.compute_txid().toString() },
        error,
      );
    }
  }

  async getFeeEstimates(network: Network): Promise<FeeEstimates> {
    try {
      return this.#clients[network].get_fee_estimates();
    } catch (error) {
      throw new ExternalServiceError(
        `Failed to fetch fee estimates`,
        { network },
        error,
      );
    }
  }

  getExplorerUrl(network: Network): string {
    return this.#config.explorerUrl[network];
  }
}
