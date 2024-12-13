import { EsploraClient, Network } from 'bdk_wasm';

import { BlockchainClient as BlockchainClient } from '../entities/chain';
import { BitcoinAccount } from '../entities';
import { ChainConfig } from '../configv2';

export class EsploraClientAdapter implements BlockchainClient {
  // Should be a Repository but we don't support custom networks so we can save in memory from config values
  protected readonly _clients: Record<Network, EsploraClient>;

  protected readonly _config: ChainConfig;

  constructor(config: ChainConfig) {
    this._clients = {
      [Network.Bitcoin]: new EsploraClient(config.url[Network.Bitcoin]),
      [Network.Testnet]: new EsploraClient(config.url[Network.Testnet]),
      [Network.Testnet4]: new EsploraClient(config.url[Network.Testnet4]),
      [Network.Signet]: new EsploraClient(config.url[Network.Signet]),
      [Network.Regtest]: new EsploraClient(config.url[Network.Regtest]),
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
    const request = account.startFullScan();
    const update = await this._clients[account.network].sync(
      request,
      this._config.parallelRequests,
    );
    account.applyUpdate(update);
  }
}
