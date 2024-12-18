import { EsploraClient, Network } from 'bitcoindevkit';

import { BlockchainClient as BlockchainClient } from '../entities/chain';
import { BitcoinAccount, ChainConfig } from '../entities';

export class EsploraClientAdapter implements BlockchainClient {
  // Should be a Repository but we don't support custom networks so we can save in memory from config values
  protected readonly _clients: Record<Network, EsploraClient>;

  protected readonly _config: ChainConfig;

  constructor(config: ChainConfig) {
    this._clients = {
      bitcoin: new EsploraClient(config.url['bitcoin']),
      testnet: new EsploraClient(config.url['testnet']),
      testnet4: new EsploraClient(config.url['testnet4']),
      signet: new EsploraClient(config.url['signet']),
      regtest: new EsploraClient(config.url['regtest']),
    };

    this._config = config;
  }

  async fullScan(account: BitcoinAccount) {
    const request = account.startFullScan();
    const update = await this._clients[account.network].full_scan(
      request,
      this._config.stopGap,
      this._config.parallelRequests,
    );
    account.applyUpdate(update);
  }

  async sync(account: BitcoinAccount) {
    const request = account.startSync();
    const update = await this._clients[account.network].sync(
      request,
      this._config.parallelRequests,
    );
    account.applyUpdate(update);
  }
}
