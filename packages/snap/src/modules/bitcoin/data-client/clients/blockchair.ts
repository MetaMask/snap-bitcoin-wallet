import { type Network, networks } from 'bitcoinjs-lib';

import { logger } from '../../../logger/logger';
import { type Balances, FeeRatio } from '../../../transaction';
import { DataClientError } from '../exceptions';
import type { GetFeeRatesResp, IReadDataClient } from '../types';

export type BlockChairClientOptions = {
  network: Network;
};

/* eslint-disable */
export type LargestTransaction = {
  hash: string;
  value_usd: number;
};

export type GetBalanceResponse = {
  data: {
    [address: string]: number;
  };
};

export type GetStatResponse = {
  data: {
    blocks: number;
    transactions: number;
    outputs: number;
    circulation: number;
    blocks_24h: number;
    transactions_24h: number;
    difficulty: number;
    volume_24h: number;
    mempool_transactions: number;
    mempool_size: number;
    mempool_tps: number;
    mempool_total_fee_usd: number;
    best_block_height: number;
    best_block_hash: string;
    best_block_time: string;
    blockchain_size: number;
    average_transaction_fee_24h: number;
    inflation_24h: number;
    median_transaction_fee_24h: number;
    cdd_24h: number;
    mempool_outputs: number;
    largest_transaction_24h: LargestTransaction;
    nodes: number;
    hashrate_24h: string;
    inflation_usd_24h: number;
    average_transaction_fee_usd_24h: number;
    median_transaction_fee_usd_24h: number;
    market_price_usd: number;
    market_price_btc: number;
    market_price_usd_change_24h_percentage: number;
    market_cap_usd: number;
    market_dominance_percentage: number;
    next_retarget_time_estimate: string;
    next_difficulty_estimate: number;
    countdowns: never[];
    suggested_transaction_fee_per_byte_sat: number;
    hodling_addresses: number;
  };
};
/* eslint-disable */

export class BlockChairClient implements IReadDataClient {
  options: BlockChairClientOptions;

  constructor(options: BlockChairClientOptions) {
    this.options = options;
  }

  get baseUrl(): string {
    switch (this.options.network) {
      case networks.bitcoin:
        return 'https://api.blockchair.com/bitcoin';
      case networks.testnet:
        return 'https://api.blockchair.com/bitcoin/testnet';
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
        `Failed to fetch data from blockchair: ${response.statusText}`,
      );
    }
    return response.json() as unknown as Resp;
  }

  async getBalances(addresses: string[]): Promise<Balances> {
    try {
      logger.info(
        `[BlockChairClient.getBalance] start: { addresses : ${JSON.stringify(
          addresses,
        )} }`,
      );

      const response = await this.get<GetBalanceResponse>(
        `/addresses/balances?addresses=${addresses.join(',')}`,
      );

      logger.info(
        `[BlockChairClient.getBalance] response: ${JSON.stringify(response)}`,
      );

      return addresses.reduce((data: Balances, address: string) => {
        data[address] = response.data[address] ?? 0;
        return data;
      }, {});
    } catch (error) {
      if (error instanceof DataClientError) {
        throw error;
      }
      throw new DataClientError(error);
    }
  }

  async getFeeRates(): Promise<GetFeeRatesResp> {
    try {
      logger.info(`[BlockChairClient.getFeeRates] start:`);
      const response = await this.get<GetStatResponse>(`/stats`);
      logger.info(
        `[BlockChairClient.getFeeRates] response: ${JSON.stringify(response)}`,
      );
      return {
        [FeeRatio.Fast]: response.data.suggested_transaction_fee_per_byte_sat,
      };
    } catch (error) {
      if (error instanceof DataClientError) {
        throw error;
      }
      throw new DataClientError(error);
    }
  }
}
