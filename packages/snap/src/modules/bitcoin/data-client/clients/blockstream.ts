import { type Network, networks } from 'bitcoinjs-lib';

import { compactError, processBatch } from '../../../../utils';
import { type Balances } from '../../../chain';
import { logger } from '../../../logger/logger';
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

  get baseUrl(): string {
    switch (this.options.network) {
      case networks.bitcoin:
        return 'https://blockstream.info/api';
      case networks.testnet:
        return 'https://blockstream.info/testnet/api';
      default:
        throw new DataClientError('Invalid network');
    }
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
    return response.json() as unknown as Resp;
  }

  async getBalances(addresses: string[]): Promise<Balances> {
    try {
      const responses: Balances = {};

      await processBatch(addresses, async (address: string) => {
        logger.info(`[BlockStreamClient.getBalance] address: ${address}`);
        let balance = 0;
        try {
          const response = await this.get<GetAddressStatsResponse>(
            `/address/${address}`,
          );
          logger.info(
            `[BlockStreamClient.getBalance] response: ${JSON.stringify(
              response,
            )}`,
          );
          balance =
            response.chain_stats.funded_txo_sum -
            response.chain_stats.spent_txo_sum;
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          logger.info(`[BlockStreamClient.getBalance] error: ${error.message}`);
        } finally {
          responses[address] = balance;
        }
      });

      return responses;
    } catch (error) {
      throw compactError(error, DataClientError);
    }
  }
}
