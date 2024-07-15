import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import type { Json } from '@metamask/snaps-sdk';
import { type Network, networks } from 'bitcoinjs-lib';
import { array, assert } from 'superstruct';

import { compactError, logger, txIdStruct } from '../../../utils';
import { FeeRatio, TransactionStatus } from '../constants';
import type {
  IDataClient,
  DataClientGetBalancesResp,
  DataClientGetTxStatusResp,
  DataClientGetUtxosResp,
  DataClientSendTxResp,
  DataClientGetFeeRatesResp,
} from '../data-client';
import { DataClientError } from '../exceptions';

export type BlockChairClientOptions = {
  network: Network;
  apiKey?: string;
};

/* eslint-disable */
export type LargestTransaction = {
  hash: string;
  value_usd: number;
};

export type GetBalancesResponse = {
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

export type GetTransactionDashboardDataResponse = {
  data: {
    [key: string]: {
      transaction: {
        block_id: number;
        id: number;
        hash: string;
        date: string;
        time: string;
        size: number;
        weight: number;
        version: number;
        lock_time: number;
        is_coinbase: boolean;
        has_witness: boolean;
        input_count: number;
        output_count: number;
        input_total: number;
        input_total_usd: number;
        output_total: number;
        output_total_usd: number;
        fee: number;
        fee_usd: number;
        fee_per_kb: number;
        fee_per_kb_usd: number;
        fee_per_kwu: number;
        fee_per_kwu_usd: number;
        cdd_total: number;
        is_rbf: boolean;
      };
      inputs: {
        block_id: number;
        transaction_id: number;
        index: number;
        transaction_hash: string;
        date: string;
        time: string;
        value: number;
        value_usd: number;
        recipient: string;
        type: string;
        script_hex: string;
        is_from_coinbase: boolean;
        is_spendable: null;
        is_spent: boolean;
        spending_block_id: number | null;
        spending_transaction_id: number | null;
        spending_index: number | null;
        spending_transaction_hash: string | null;
        spending_date: string | null;
        spending_time: string | null;
        spending_value_usd: number | null;
        spending_sequence: number | null;
        spending_signature_hex: string | null;
        spending_witness: string | null;
        lifespan: number | null;
        cdd: number | null;
      }[];
      outputs: {
        block_id: number;
        transaction_id: number;
        index: number;
        transaction_hash: string;
        date: string;
        time: string;
        value: number;
        value_usd: number;
        recipient: string;
        type: string;
        script_hex: string;
        is_from_coinbase: boolean;
        is_spendable: null;
        is_spent: boolean;
        spending_block_id: null;
        spending_transaction_id: null;
        spending_index: null;
        spending_transaction_hash: null;
        spending_date: null;
        spending_time: null;
        spending_value_usd: null;
        spending_sequence: null;
        spending_signature_hex: null;
        spending_witness: null;
        lifespan: null;
        cdd: null;
      }[];
    };
  };
  context: {
    state: number;
  };
};

export type PostTransactionResponse = {
  data: {
    transaction_hash: string;
  };
};
/* eslint-disable */

export class BlockChairClient implements IDataClient {
  protected readonly _options: BlockChairClientOptions;

  constructor(options: BlockChairClientOptions) {
    this._options = options;
  }

  get baseUrl(): string {
    switch (this._options.network) {
      case networks.bitcoin:
        return 'https://api.blockchair.com/bitcoin';
      case networks.testnet:
        return 'https://api.blockchair.com/bitcoin/testnet';
      default:
        throw new Error('Invalid network');
    }
  }

  protected getApiUrl(endpoint: string): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    // TODO: Update to proxy
    if (this._options.apiKey) {
      url.searchParams.append('key', this._options.apiKey);
    }
    return url.toString();
  }

  protected async get<Resp>(endpoint: string): Promise<Resp> {
    const response = await fetch(this.getApiUrl(endpoint), {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(
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
      throw new Error(
        `Failed to post data from blockchair: ${res.context.error}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Failed to post data from blockchair: ${response.statusText}`,
      );
    }
    return response.json() as unknown as Resp;
  }

  protected async getTxDashboardData(
    txHash: string,
  ): Promise<GetTransactionDashboardDataResponse> {
    try {
      assert(txHash, txIdStruct);

      logger.info(`[BlockChairClient.getTxDashboardData] start:`);
      const response = await this.get<GetTransactionDashboardDataResponse>(
        `/dashboards/transaction/${txHash}`,
      );
      logger.info(
        `[BlockChairClient.getTxDashboardData] response: ${JSON.stringify(
          response,
        )}`,
      );
      return response;
    } catch (error) {
      logger.info(
        `[BlockChairClient.getTxDashboardData] error: ${error.message}`,
      );
      throw compactError(error, DataClientError);
    }
  }

  async getBalances(addresses: string[]): Promise<DataClientGetBalancesResp> {
    try {
      assert(addresses, array(BtcP2wpkhAddressStruct));

      logger.info(
        `[BlockChairClient.getBalance] start: { addresses : ${JSON.stringify(
          addresses,
        )} }`,
      );

      const response = await this.get<GetBalancesResponse>(
        `/addresses/balances?addresses=${addresses.join(',')}`,
      );

      logger.info(
        `[BlockChairClient.getBalance] response: ${JSON.stringify(response)}`,
      );

      return addresses.reduce(
        (data: DataClientGetBalancesResp, address: string) => {
          data[address] = response.data[address] ?? 0;
          return data;
        },
        {},
      );
    } catch (error) {
      logger.info(`[BlockChairClient.getBalance] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<DataClientGetUtxosResp> {
    try {
      assert(address, BtcP2wpkhAddressStruct);

      let process = true;
      let offset = 0;
      const limit = 1000;
      const data: DataClientGetUtxosResp = [];

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
          throw new Error(`Data not avaiable`);
        }

        response.data[address].utxo.forEach((utxo) => {
          data.push({
            block: utxo.block_id,
            txHash: utxo.transaction_hash,
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
      logger.info(`[BlockChairClient.getUtxos] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getFeeRates(): Promise<DataClientGetFeeRatesResp> {
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
      logger.info(`[BlockChairClient.getFeeRates] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async sendTransaction(
    signedTransaction: string,
  ): Promise<DataClientSendTxResp> {
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
      logger.info(`[BlockChairClient.sendTransaction] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getTransactionStatus(
    txHash: string,
  ): Promise<DataClientGetTxStatusResp> {
    try {
      const response = await this.getTxDashboardData(txHash);

      let status = TransactionStatus.Pending;

      if (
        typeof response.data === 'object' &&
        Object.prototype.hasOwnProperty.call(response.data, txHash)
      ) {
        const isInMempool = response.data[txHash].transaction.block_id === -1;

        status = isInMempool
          ? TransactionStatus.Pending
          : TransactionStatus.Confirmed;
      }

      return {
        status: status,
      };
    } catch (error) {
      logger.info(
        `[BlockChairClient.getTransactionStatus] error: ${error.message}`,
      );
      throw compactError(error, DataClientError);
    }
  }
}
