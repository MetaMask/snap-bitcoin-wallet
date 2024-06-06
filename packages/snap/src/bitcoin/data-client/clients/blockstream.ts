import { type Network, networks } from 'bitcoinjs-lib';

import type { TransactionStatusData } from '../../../chain';
import { type Balances, FeeRatio, TransactionStatus } from '../../../chain';
import { logger } from '../../../libs/logger/logger';
import { compactError, processBatch } from '../../../utils';
import type { Utxo } from '../../wallet';
import { DataClientError } from '../exceptions';
import type { GetFeeRatesResp, IReadDataClient } from '../types';

export type BlockStreamClientOptions = {
  network: Network;
};

/* eslint-disable */
export type GetFeeEstimateResponse = Record<string, number>;

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

export type GetTransactionStatusResponse = {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
};

export type GetUtxosResponse = {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
  value: number;
}[];

export type GetBlocksResponse = {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}[];

/* eslint-enable */

export class BlockStreamClient implements IReadDataClient {
  protected readonly _options: BlockStreamClientOptions;

  protected readonly _feeRateRatioMap: Record<FeeRatio, string>;

  constructor(options: BlockStreamClientOptions) {
    this._options = options;
    this._feeRateRatioMap = {
      [FeeRatio.Fast]: '1',
      [FeeRatio.Medium]: '144',
      [FeeRatio.Slow]: '144',
    };
  }

  get baseUrl(): string {
    switch (this._options.network) {
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

  async getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<Utxo[]> {
    try {
      const response = await this.get<GetUtxosResponse>(
        `/address/${address}/utxo`,
      );

      logger.info(
        `[BlockStreamClient.getUtxos] response: ${JSON.stringify(response)}`,
      );

      const data: Utxo[] = [];

      for (const utxo of response) {
        if (!includeUnconfirmed && !utxo.status.confirmed) {
          continue;
        }
        data.push({
          block: utxo.status.block_height,
          txHash: utxo.txid,
          index: utxo.vout,
          value: utxo.value,
        });
      }

      return data;
    } catch (error) {
      throw compactError(error, DataClientError);
    }
  }

  async getFeeRates(): Promise<GetFeeRatesResp> {
    try {
      logger.info(`[BlockStreamClient.getFeeRates] start:`);
      const response = await this.get<GetFeeEstimateResponse>(`/fee-estimates`);
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(
        `[BlockStreamClient.getFeeRates] response: ${JSON.stringify(response)}`,
      );
      return {
        [FeeRatio.Fast]: Math.round(
          response[this._feeRateRatioMap[FeeRatio.Fast]],
        ),
        [FeeRatio.Medium]: Math.round(
          response[this._feeRateRatioMap[FeeRatio.Medium]],
        ),
        [FeeRatio.Slow]: Math.round(
          response[this._feeRateRatioMap[FeeRatio.Slow]],
        ),
      };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[BlockStreamClient.getFeeRates] error: ${error.message}`);
      if (error instanceof DataClientError) {
        throw error;
      }
      throw new DataClientError(error);
    }
  }

  async getTransactionStatus(txHash: string): Promise<TransactionStatusData> {
    try {
      const txStatusResp = await this.get<GetTransactionStatusResponse>(
        `/tx/${txHash}/status`,
      );

      const status = txStatusResp.confirmed
        ? TransactionStatus.Confirmed
        : TransactionStatus.Pending;

      return {
        status,
      };
    } catch (error) {
      throw compactError(error, DataClientError);
    }
  }
}
