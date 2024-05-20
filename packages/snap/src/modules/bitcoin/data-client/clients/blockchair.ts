import type { Json } from '@metamask/snaps-sdk';
import { type Network, networks } from 'bitcoinjs-lib';

import { compactError } from '../../../../utils';
import { type Balances } from '../../../chain';
import { logger } from '../../../logger/logger';
import { DataClientError } from '../exceptions';
import type { IReadDataClient, IWriteDataClient } from '../types';

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

export type PostTransactionResponse = {
  data: {
    transaction_hash: string;
  };
};
/* eslint-disable */

export class BlockChairClient implements IReadDataClient, IWriteDataClient {
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

  protected getApiUrl(endpoint: string): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    // TODO: Update to proxy
    if (this.options.apiKey) {
      url.searchParams.append('key', this.options.apiKey);
    }
    return url.toString();
  }

  protected async get<Resp>(endpoint: string): Promise<Resp> {
    const response = await fetch(this.getApiUrl(endpoint), {
      method: 'GET',
    });

    if (!response.ok) {
      throw new DataClientError(
        `Failed to fetch data from blockchair: ${response.statusText}`,
      );
    }
    return response.json() as unknown as Resp;
  }

  protected async post<Resp>(endpoint: string, body: Json): Promise<Resp> {
    const response = await fetch(this.getApiUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status == 400) {
      const res = await response.json();
      throw new DataClientError(
        `Failed to post data from blockchair: ${res.context.error}`,
      );
    }

    if (!response.ok) {
      throw new DataClientError(
        `Failed to post data from blockchair: ${response.statusText}`,
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

  async sendTransaction(signedTransaction: string): Promise<string> {
    try {
      const response = await this.post<PostTransactionResponse>(
        `/push/transaction`,
        {
          data: signedTransaction,
        },
      );

      logger.info(
        `[BlockChairClient.sendTransaction] response: ${JSON.stringify(
          response,
        )}`,
      );

      return response.data.transaction_hash;
    } catch (error) {
      throw compactError(error, DataClientError);
    }
  }
}
