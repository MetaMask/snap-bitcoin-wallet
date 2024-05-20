import { type Network, networks } from 'bitcoinjs-lib';

import { compactError } from '../../../../utils';
import { type Balances, type Utxo, FeeRatio } from '../../../chain';
import { logger } from '../../../logger/logger';
import { DataClientError } from '../exceptions';
import type { GetFeeRatesResp, IReadDataClient } from '../types';

export type BlockChairClientOptions = {
  network: Network;
  apiKey?: string;
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
export type GetUtxosResponse = {
  data: {
    [address: string]: {
      address: {
        type: string;
        script_hex: string;
        balance: number;
        balance_usd: number;
        received: number;
        received_usd: number;
        spent: number;
        spent_usd: number;
        output_count: number;
        unspent_output_count: number;
        first_seen_receiving: string;
        last_seen_receiving: string;
        first_seen_spending: string;
        last_seen_spending: string;
        scripthash_type: null;
        transaction_count: null;
      };
      transactions: any[];
      utxo: {
        block_id: number;
        transaction_hash: string;
        index: number;
        value: number;
      }[];
    };
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
    const url = new URL(`${this.baseUrl}${endpoint}`);
    // TODO: Update to proxy
    if (this.options.apiKey) {
      url.searchParams.append('key', this.options.apiKey);
    }

    const response = await fetch(url.toString(), {
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
      throw compactError(error, DataClientError);
    }
  }

  // TODO: add logic to get UTXOs that sufficiently cover the amount, to reduce the number of requests
  async getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<Utxo[]> {
    try {
      let process = true;
      let offset = 0;
      const limit = 1000;
      const data: Utxo[] = [];

      while (process) {
        let url = `/dashboards/address/${address}?limit=0,${limit}&offset=0,${offset}`;
        if (!includeUnconfirmed) {
          url += '&state=latest';
        }

        const response = await this.get<GetUtxosResponse>(url);

        logger.info(
          `[BlockChairClient.getUtxos] response: ${JSON.stringify(response)}`,
        );

        if (!Object.prototype.hasOwnProperty.call(response.data, address)) {
          throw new DataClientError(`Data not avaiable`);
        }

        response.data[address].utxo.forEach((utxo) => {
          data.push({
            block: utxo.block_id,
            txnHash: utxo.transaction_hash,
            index: utxo.index,
            value: utxo.value,
          });
        });

        offset += 1;

        if (response.data[address].utxo.length < limit) {
          process = false;
        }
      }

      return data;
    } catch (error) {
      throw compactError(error, DataClientError);
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
