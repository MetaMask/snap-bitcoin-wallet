import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import type { Json } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import type { Struct } from 'superstruct';
import { array, assert, mask } from 'superstruct';

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
import {
  type QuickNodeClientOptions,
  type QuickNodeGetBalancesResponse,
  type QuickNodeGetUtxosResponse,
  type QuickNodeSendTransactionResponse,
  type QuickNodeEstimateFeeResponse,
  type QuickNodeGetTransaction,
  type QuickNodeResponse,
  QuickNodeGetBalancesResponseStruct,
  QuickNodeGetUtxosResponseStruct,
  QuickNodeSendTransactionResponseStruct,
  QuickNodeGetTransactionStruct,
  QuickNodeEstimateFeeResponseStruct,
} from './quicknode.types';

export class QuickNodeClient implements IDataClient {
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

  protected async post<Response extends QuickNodeResponse>(
    body: Json,
  ): Promise<Response> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // QuickNode returns 200 status code for successful requests, others are errors status code
    if (response.status !== 200) {
      const res = (await response.json()) as unknown as Response;
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

  protected isErrorResponse<Response extends { result: unknown }>(
    response: Response,
  ): boolean {
    // Possible error response from QuickNode:
    // - { result : null, error : "some error message" }
    // - { result : null, error : { code: -8, message: "some error message" } }
    // - { result : { error : "some error message" } }
    // - empty
    return (
      !response.result ||
      Object.prototype.hasOwnProperty.call(response.result, 'error')
    );
  }

  protected async submitJsonRPCRequest<Response extends QuickNodeResponse>({
    request,
    responseStruct,
  }: {
    request: {
      method: string;
      params: Json;
    };
    responseStruct: Struct;
  }) {
    try {
      logger.debug(
        `[QuickNodeClient.${request.method}] request:`,
        JSON.stringify(request),
      );

      const response = await this.post<Response>(request);

      logger.debug(
        `[QuickNodeClient.${request.method}] response:`,
        JSON.stringify(response),
      );

      // Safeguard to detect if the response is an error response, but they are not caught by the fetch error
      if (this.isErrorResponse(response)) {
        throw new Error(`Error response from quicknode`);
      }

      // Safeguard to identify if the response has some unexpected changes from quicknode
      mask(response, responseStruct, 'Unexpected response from quicknode');

      return response;
    } catch (error) {
      logger.info(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `[QuickNodeClient.${request.method}] error: ${error.message}`,
      );

      throw compactError(error, DataClientError);
    }
  }

  protected isApiRespError<Resp extends { result: unknown }>(
    resp: Resp,
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
    assert(addresses, array(BtcP2wpkhAddressStruct));

    const addressBalanceMap = new Map<string, number>();

    await processBatch(addresses, async (address) => {
      const response =
        await this.submitJsonRPCRequest<QuickNodeGetBalancesResponse>({
          // index 0 of the params refer to the account address,
          // index 1 .details refer to the output flag:
          // - 'basic' for basic address information
          // - 'txids' to also include transaction IDs
          // - 'txs' to include full transaction data
          request: {
            method: 'bb_getaddress',
            params: [
              address,
              {
                details: 'basic',
              },
            ],
          },
          responseStruct: QuickNodeGetBalancesResponseStruct,
        });

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
  }

  async getUtxos(
    address: string,
    includeUnconfirmed?: boolean,
  ): Promise<DataClientGetUtxosResp> {
    assert(address, BtcP2wpkhAddressStruct);

    const response = await this.submitJsonRPCRequest<QuickNodeGetUtxosResponse>(
      {
        request: {
          method: 'bb_getutxos',
          params: [
            address,
            {
              confirmed: !includeUnconfirmed,
            },
          ],
        },
        responseStruct: QuickNodeGetUtxosResponseStruct,
      },
    );

    return response.result.map((utxo) => ({
      block: utxo.height,
      txHash: utxo.txid,
      index: utxo.vout,
      // the utxo.value will be return as sats
      // it is safe to use number in bitcoin rather than big int, due to max sats will not exceed 2100000000000000
      value: parseInt(utxo.value, 10),
    }));
  }

  async getFeeRates(): Promise<DataClientGetFeeRatesResp> {
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
        const response =
          await this.submitJsonRPCRequest<QuickNodeEstimateFeeResponse>({
            request: {
              method: 'estimatesmartfee',
              params: [target],
            },
            responseStruct: QuickNodeEstimateFeeResponseStruct,
          });

        // The fee rate will be returned in btc unit
        // e.g. 0.00005081
        feeRates[feeRate] = Number(
          btcToSats(response.result.feerate.toString()),
        );
      },
    );

    return feeRates;
  }

  async sendTransaction(
    signedTransaction: string,
  ): Promise<DataClientSendTxResp> {
    const response =
      await this.submitJsonRPCRequest<QuickNodeSendTransactionResponse>({
        request: {
          method: 'sendrawtransaction',
          params: [signedTransaction],
        },
        responseStruct: QuickNodeSendTransactionResponseStruct,
      });
    return response.result;
  }

  async getTransactionStatus(txid: string): Promise<DataClientGetTxStatusResp> {
    const response = await this.submitJsonRPCRequest<QuickNodeGetTransaction>({
      // index 0 of the params refer to the tx id,
      // index 1 refer to the verbose flag,
      // - 0: hex-encoded data
      // - 1: JSON object
      // - 2: JSON object with fee and prevout
      request: { method: 'getrawtransaction', params: [txid, 1] },
      responseStruct: QuickNodeGetTransactionStruct,
    });

    // Bitcoin transaction is often considered secure after six confirmations
    // reference: https://www.bitcoin.com/get-started/what-is-a-confirmation/#:~:text=Different%20cryptocurrencies%20require%20different%20numbers,secure%20after%20around%2030%20confirmations.
    return {
      status:
        // If `confirmations` is not defined, then the transaction is "pending" in the memory pool.
        response.result.confirmations &&
        response.result.confirmations >= Config.defaultConfirmationThreshold
          ? TransactionStatus.Confirmed
          : TransactionStatus.Pending,
    };
  }
}
