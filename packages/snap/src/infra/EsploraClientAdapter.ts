import type {
  FeeEstimates,
  Network,
  Transaction,
} from '@bitcoindevkit/bdk-wallet-web';
import { EsploraClient } from '@bitcoindevkit/bdk-wallet-web';

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
      bitcoin: new EsploraClient(config.url.bitcoin, config.maxRetries),
      testnet: new EsploraClient(config.url.testnet, config.maxRetries),
      testnet4: new EsploraClient(config.url.testnet4, config.maxRetries),
      signet: new EsploraClient(config.url.signet, config.maxRetries),
      regtest: new EsploraClient(config.url.regtest, config.maxRetries),
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
      account.applyUpdate(update);
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
      account.applyUpdate(update);
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
      await this.#clients[network].broadcast(transaction);
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
      return await this.#clients[network].get_fee_estimates();
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
