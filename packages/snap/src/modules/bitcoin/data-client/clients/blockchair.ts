import { type Network, networks } from 'bitcoinjs-lib';

import { compactError } from '../../../../utils';
import { type Balances } from '../../../chain';
import { logger } from '../../../logger/logger';
import { DataClientError } from '../exceptions';
import type { IReadDataClient, Utxo } from '../types';

export type BlockChairClientOptions = {
  network: Network;
  apiKey?: string;
};

/* eslint-disable */
export type GetBalanceResponse = {
  data: {
    [address: string]: number;
  };
  context: {
    code: number;
    source: string;
    results: number;
    state: number;
    market_price_usd: number;
    cache: {
      live: boolean;
      duration: number;
      since: string;
      until: string;
      time: null;
    };
    api: {
      version: string;
      last_major_update: string;
      next_major_update: string;
      documentation: string;
      notice: string;
    };
    servers: string;
    time: number;
    render_time: number;
    full_time: number;
    request_cost: number;
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

  async getUtxos(address: string): Promise<Utxo[]> {
    try {
      let process = true;
      let offset = 0;
      const limit = 1000;
      const data: Utxo[] = []
      while (process) {
        const response = await this.get<GetUtxosResponse>(
          `/dashboards/address/${address}?limit=0,${limit}&offset=0,${offset}&state=latest`,
        );

        logger.info(
          `[BlockChairClient.getUtxos] response: ${JSON.stringify(response)}`,
        );

        if (!response.data[address]) {
          throw new DataClientError(`No data avaiable for address ${address}`);
        }

        if (response.data[address].utxo.length < limit) {
          break;
        }

        response.data[address].utxo.forEach((utxo) => {
          data.push({
            block: utxo.block_id,
            txnHash: utxo.transaction_hash,
            index: utxo.index,
            value: utxo.value,
          })
        });
        
        offset += 1
      }

      return data;
    } catch (error) {
      throw compactError(error, DataClientError);
    }
  }
}
