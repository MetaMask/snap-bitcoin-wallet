import { type Network, networks } from 'bitcoinjs-lib';

import { compactError } from '../../../../utils';
import { type Balances } from '../../../chain';
import { logger } from '../../../logger/logger';
import { DataClientError } from '../exceptions';
import type { IReadDataClient } from '../types';

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
}
