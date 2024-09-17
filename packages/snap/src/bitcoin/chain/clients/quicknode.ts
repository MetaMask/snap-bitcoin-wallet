import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import type { Json } from '@metamask/snaps-sdk';
import { type Network, networks } from 'bitcoinjs-lib';
import { array, assert } from 'superstruct';

import { Config } from '../../../config';
import { btcToSats, compactError, logger, processBatch } from '../../../utils';
import { FeeRate, TransactionStatus } from '../constants';
import type {
  IDataClient,
  DataClientGetBalancesResp,
  DataClientGetTxStatusResp,
  DataClientGetUtxosResp,
  DataClientSendTxResp,
  DataClientGetFeeRatesResp,
} from '../data-client';
import { DataClientError } from '../exceptions';

export type QuicknodeClientOptions = {
  network: Network;
  // The endpoints will be setup via the environment variable
  testnetEndpoint: string;
  mainnetEndpoint: string;
};

/* eslint-disable */
export type QNGetBalancesResponse = {
  result: null | {
    address: string;
    balance: string;
    totalReceived: string;
    totalSent: string;
    unconfirmedBalance: string;
    unconfirmedTxs: number;
    txs: number;
  };
  error: null | {
    code: string;
    message: string;
  };
};

export type QNGetUtxosResponse = {
  result:
    | null
    | {
        txid: string;
        vout: number;
        value: string;
        height: number;
        confirmations: number;
      }[];
  error: null | {
    code: string;
    message: string;
  };
};

export type QNSubmitTransactionResponse = {
  hex: string;
};

export type QNEstimateFeeResponse = {
  result: null | {
    blocks: number;
    feerate: number;
  };
  error: null | {
    code: string;
    message: string;
  };
};

export type QNGetTransaction = {
  result: null | {
    txid: string;
    hash: string;
    version: number;
    size: number;
    vsize: number;
    weight: number;
    locktime: number;
    vin: {
      txid: string;
      vout: number;
      scriptSig: {
        asm: string;
        hex: string;
      };
      txinwitness: string[];
      sequence: number;
    }[];
    vout: {
      value: number;
      n: number;
      scriptPubKey: Record<string, string>;
    }[];
    hex: string;
    blockhash: string;
    confirmations: number;
    time: number;
    blocktime: number;
  };
  error: null | {
    code: string;
    message: string;
  };
};
/* eslint-enable */

export class QuicknodeClient implements IDataClient {
  protected readonly _options: QuicknodeClientOptions;

  protected readonly _priorityMap: Record<FeeRate, number>;

  constructor(options: QuicknodeClientOptions) {
    this._options = options;
    this._priorityMap = {
      [FeeRate.Fast]: 1,
      [FeeRate.Medium]: 2,
      [FeeRate.Slow]: 3,
    };
  }

  get baseUrl(): string {
    switch (this._options.network) {
      case networks.bitcoin:
        return this._options.mainnetEndpoint;
      case networks.testnet:
        return this._options.testnetEndpoint;
      default:
        throw new Error('Invalid network');
    }
  }

  protected async post<Resp>(body: Json): Promise<Resp> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status !== 200) {
      const res = await response.json();
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Failed to post data from quicknode: ${res.context.error}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Failed to post data from quicknode: ${response.statusText}`,
      );
    }
    return response.json() as unknown as Resp;
  }

  async getBalances(addresses: string[]): Promise<DataClientGetBalancesResp> {
    try {
      assert(addresses, array(BtcP2wpkhAddressStruct));

      logger.info(
        `[QuicknodeClient.getBalance] start: { addresses : ${JSON.stringify(
          addresses,
        )} }`,
      );

      const addressBalanceMap = new Map<string, number>();

      await processBatch(addresses, async (address) => {
        const response = await this.post<QNGetBalancesResponse>(
          // index 0 of the params refer to the account address,
          // index 1.details refer to the output flag:
          // 'basic' for basic address information, 'txids' for include tx ids into the response, 'txs' for include full transaction data
          {
            method: 'bb_getaddress',
            params: [
              address,
              {
                details: 'basic',
              },
            ],
          },
        );

        logger.info(
          `[QuicknodeClient.getBalance] response: ${JSON.stringify(response)}`,
        );

        // A safeguard to ensure the response is valid.
        if (response.result === null) {
          throw new Error(`Get balance response is invalid`);
        }

        // the balance will be return as sats
        // it is safe to use number in bitcoin rather than big int, due to max sats will not exceed 2100000000000000
        addressBalanceMap.set(address, parseInt(response.result.balance, 10));
      });

      return addresses.reduce(
        (data: DataClientGetBalancesResp, address: string) => {
          data[address] = addressBalanceMap.get(address) ?? 0;
          return data;
        },
        {},
      );
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[QuicknodeClient.getBalance] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<DataClientGetUtxosResp> {
    try {
      assert(address, BtcP2wpkhAddressStruct);

      const response = await this.post<QNGetUtxosResponse>({
        method: 'bb_getutxos',
        params: [
          address,
          {
            confirmed: !includeUnconfirmed,
          },
        ],
      });

      logger.info(
        `[QuicknodeClient.getUtxos] response: ${JSON.stringify(response)}`,
      );

      // A safeguard to ensure the response is valid.
      if (response.result === null) {
        throw new Error(`Get utxos response is invalid`);
      }

      return response.result.map((utxo) => ({
        block: utxo.height,
        txHash: utxo.txid,
        index: utxo.vout,
        // the utxo.value will be return as sats
        // it is safe to use number in bitcoin rather than big int, due to max sats will not exceed 2100000000000000
        value: parseInt(utxo.value, 10),
      }));
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[QuicknodeClient.getUtxos] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getFeeRates(): Promise<DataClientGetFeeRatesResp> {
    try {
      logger.info(`[QuicknodeClient.getFeeRates] start:`);
      // There is no UX to allow end user to select the fee rate,
      // hence we can just fetch the default fee rate.
      const processItems = {
        [Config.defaultFeeRate]: this._priorityMap[Config.defaultFeeRate],
      };

      const feeRates: Record<string, number> = {};
      // keep this batch process in case we have to switch to support multiple fee rates.
      await processBatch(
        Object.entries(processItems),
        async ([feeRate, target]) => {
          const response = await this.post<QNEstimateFeeResponse>({
            method: 'estimatesmartfee',
            params: [target],
          });

          logger.info(
            `[QuicknodeClient.getFeeRates] response: ${JSON.stringify(
              response,
            )}`,
          );

          // A safeguard to ensure the response is valid.
          if (response.result === null) {
            throw new Error(`Get fee rate response is invalid`);
          }

          // The fee rate will be returned in btc unit
          // e.g. 0.00005081
          feeRates[feeRate] = Number(
            btcToSats(response.result.feerate.toString()),
          );
        },
      );

      return feeRates;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[QuicknodeClient.getFeeRates] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async sendTransaction(
    signedTransaction: string,
  ): Promise<DataClientSendTxResp> {
    try {
      const response = await this.post<QNSubmitTransactionResponse>({
        method: 'sendrawtransaction',
        params: [signedTransaction],
      });

      logger.info(
        `[QuicknodeClient.sendTransaction] response: ${JSON.stringify(
          response,
        )}`,
      );

      return response.hex;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[QuicknodeClient.sendTransaction] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getTransactionStatus(txid: string): Promise<DataClientGetTxStatusResp> {
    try {
      const response = await this.post<QNGetTransaction>(
        // index 0 of the params refer to the tx id,
        // index 1 refer to the verbose flag,
        // 0 for hex-encoded data, '1' for JSON object and '2' for JSON object with fee and prevout
        { method: 'getrawtransaction', params: [txid, 1] },
      );

      logger.info(
        `[QuicknodeClient.getTransactionStatus] response: ${JSON.stringify(
          response,
        )}`,
      );

      // A safeguard to ensure the response is valid.
      if (response?.result === null) {
        throw new Error(`Get transaction response is invalid`);
      }

      // Bitcoin transaction is often considered secure after six confirmations
      // reference: https://www.bitcoin.com/get-started/what-is-a-confirmation/#:~:text=Different%20cryptocurrencies%20require%20different%20numbers,secure%20after%20around%2030%20confirmations.
      return {
        status:
          response.result.confirmations >= 6
            ? TransactionStatus.Confirmed
            : TransactionStatus.Pending,
      };
    } catch (error) {
      logger.info(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `[QuicknodeClient.getTransactionStatus] error: ${error.message}`,
      );
      throw compactError(error, DataClientError);
    }
  }
}
