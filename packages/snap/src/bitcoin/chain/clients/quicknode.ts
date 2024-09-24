import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import type { Json } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
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
import type {
  QuickNodeClientOptions,
  QuickNodeGetBalancesResponse,
  QuickNodeGetUtxosResponse,
  QuickNodeSendTransactionResponse,
  QuickNodeEstimateFeeResponse,
  QuickNodeGetTransaction,
} from './quicknode.types';

export class QuickNodeClient implements IDataClient {
  protected readonly _confirmationThreshold = 6;

  protected readonly _options: QuickNodeClientOptions;

  protected readonly _priorityMap: Record<FeeRate, number>;

  constructor(options: QuickNodeClientOptions) {
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

  protected async post<Response>(body: Json): Promise<Response> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // QuickNode returns 200 status code for successful requests, others are errors status code
    if (response.status !== 200) {
      const res = await response.json();
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Failed to post data from quicknode: ${res.error}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Failed to post data from quicknode: ${response.statusText}`,
      );
    }
    return response.json() as unknown as Response;
  }

  protected isApiRespError<Response extends { result: unknown }>(
    resp: Response,
  ): boolean {
    // Possible error response from QuickNode:
    // - { result : null, error : "some error message" }
    // - { result : null, error : { code: -8, message: "some error message" } }
    // - { result : { error : "some error message" } }
    // - empty
    return (
      !resp.result || Object.prototype.hasOwnProperty.call(resp.result, 'error')
    );
  }

  async getBalances(addresses: string[]): Promise<DataClientGetBalancesResp> {
    try {
      assert(addresses, array(BtcP2wpkhAddressStruct));

      logger.debug(
        `[QuickNodeClient.getBalance] start: { addresses : ${JSON.stringify(
          addresses,
        )} }`,
      );

      const addressBalanceMap = new Map<string, number>();

      await processBatch(addresses, async (address) => {
        const response = await this.post<QuickNodeGetBalancesResponse>(
          // index 0 of the params refer to the account address,
          // index 1 .details refer to the output flag:
          // - 'basic' for basic address information
          // - 'txids' to also include transaction IDs
          // - 'txs' to include full transaction data
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

        logger.debug(
          `[QuickNodeClient.getBalance] response: ${JSON.stringify(response)}`,
        );

        // A safeguard to ensure the response is valid.
        if (!response.result || this.isApiRespError(response)) {
          throw new Error(`Get balance response is invalid`);
        }

        // the balance will be return as sats
        // it is safe to use number in bitcoin rather than big int, due to max sats will not exceed 2100000000000000
        addressBalanceMap.set(address, parseInt(response.result.balance, 10));
      });

      return addresses.reduce(
        (data: DataClientGetBalancesResp, address: string) => {
          // The hashmap should include the balance for each requested addresses
          // but in case there are some behavior changes, we set the default balance to 0
          data[address] = addressBalanceMap.get(address) ?? 0;
          return data;
        },
        {},
      );
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[QuickNodeClient.getBalance] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<DataClientGetUtxosResp> {
    try {
      assert(address, BtcP2wpkhAddressStruct);

      const response = await this.post<QuickNodeGetUtxosResponse>({
        method: 'bb_getutxos',
        params: [
          address,
          {
            confirmed: !includeUnconfirmed,
          },
        ],
      });

      logger.debug(
        `[QuickNodeClient.getUtxos] response: ${JSON.stringify(response)}`,
      );

      // A safeguard to ensure the response is valid.
      if (!response.result || this.isApiRespError(response)) {
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
      logger.info(`[QuickNodeClient.getUtxos] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getFeeRates(): Promise<DataClientGetFeeRatesResp> {
    try {
      logger.debug(`[QuickNodeClient.getFeeRates] start:`);
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
          const response = await this.post<QuickNodeEstimateFeeResponse>({
            method: 'estimatesmartfee',
            params: [target],
          });

          logger.debug(
            `[QuickNodeClient.getFeeRates] response: ${JSON.stringify(
              response,
            )}`,
          );

          // A safeguard to ensure the response is valid.
          if (!response.result || this.isApiRespError(response)) {
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
      logger.info(`[QuickNodeClient.getFeeRates] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async sendTransaction(
    signedTransaction: string,
  ): Promise<DataClientSendTxResp> {
    try {
      const response = await this.post<QuickNodeSendTransactionResponse>({
        method: 'sendrawtransaction',
        params: [signedTransaction],
      });

      logger.debug(
        `[QuickNodeClient.sendTransaction] response: ${JSON.stringify(
          response,
        )}`,
      );

      // A safeguard to ensure the response is valid.
      if (!response.result || this.isApiRespError(response)) {
        throw new Error(`send transaction response is invalid`);
      }

      return response.result.hex;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      logger.info(`[QuickNodeClient.sendTransaction] error: ${error.message}`);
      throw compactError(error, DataClientError);
    }
  }

  async getTransactionStatus(txid: string): Promise<DataClientGetTxStatusResp> {
    try {
      const response = await this.post<QuickNodeGetTransaction>(
        // index 0 of the params refer to the tx id,
        // index 1 refer to the verbose flag,
        // - 0: hex-encoded data
        // - 1: JSON object
        // - 2: JSON object with fee and prevout
        { method: 'getrawtransaction', params: [txid, 1] },
      );

      logger.debug(
        `[QuickNodeClient.getTransactionStatus] response: ${JSON.stringify(
          response,
        )}`,
      );

      // A safeguard to ensure the response is valid.
      if (!response.result || this.isApiRespError(response)) {
        throw new Error(`Get transaction response is invalid`);
      }

      // Bitcoin transaction is often considered secure after six confirmations
      // reference: https://www.bitcoin.com/get-started/what-is-a-confirmation/#:~:text=Different%20cryptocurrencies%20require%20different%20numbers,secure%20after%20around%2030%20confirmations.
      return {
        status:
          response.result.confirmations >= this._confirmationThreshold
            ? TransactionStatus.Confirmed
            : TransactionStatus.Pending,
      };
    } catch (error) {
      logger.info(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `[QuickNodeClient.getTransactionStatus] error: ${error.message}`,
      );
      throw compactError(error, DataClientError);
    }
  }
}
