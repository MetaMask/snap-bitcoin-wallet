import { type Network, networks } from 'bitcoinjs-lib';

import { logger } from '../../../logger/logger';
import { type Balance } from '../../../transaction';
import { DataClientError } from '../exceptions';
import type { IReadDataClient } from '../types';

export type BlockStreamClientOptions = {
  network: Network;
};

/* eslint-disable */
export type GetAddressStatsResponse = {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
};
/* eslint-enable */

export class BlockStreamClient implements IReadDataClient {
  options: BlockStreamClientOptions;

  constructor(options: BlockStreamClientOptions) {
    this.options = options;
  }

  get baseUrl() {
    if (this.options.network === networks.bitcoin) {
      return 'https://blockstream.info/api';
    }
    return 'https://blockstream.info/testnet/api';
  }

  protected async get<Resp>(endpoint: string): Promise<Resp> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new DataClientError(
        `Failed to fetch data from blockstream: ${response.statusText}`,
      );
    }
    return response.json() as Resp;
  }

  async getBalance(address: string): Promise<Balance> {
    try {
      const response = await this.get<GetAddressStatsResponse>(
        `/address/${address}`,
      );

      logger.info(
        `[BlockStreamClient.getBalance] response: ${JSON.stringify(response)}`,
      );

      const confirmed =
        response.chain_stats.funded_txo_sum -
        response.chain_stats.spent_txo_sum;
      const unconfirmed =
        response.mempool_stats.funded_txo_sum -
        response.mempool_stats.spent_txo_sum;
      return {
        confirmed,
        unconfirmed,
        total: confirmed + unconfirmed,
      };
    } catch (error) {
      if (error instanceof DataClientError) {
        throw error;
      }
      throw new DataClientError(error);
    }
  }
}
