import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import type { Json } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import type { Struct } from 'superstruct';
import { array, assert } from 'superstruct';

import { Config } from '../../../config';
import {
  btcToSats,
  getMinimumFeeRateInKvb,
  logger,
  processBatch,
  satsKvbToVb,
} from '../../../utils';
import type { HttpResponse } from '../api-client';
import { ApiClient } from '../api-client';
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
import type { QuickNodeGetMempoolResponse } from './quicknode.types';
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
  QuickNodeGetMempoolStruct,
} from './quicknode.types';

const MAINNET_CONFIRMATION_TARGET = {
  [FeeRate.Fast]: 1,
  [FeeRate.Medium]: 2,
  [FeeRate.Slow]: 3,
};

// FIXME: There's an issue right now with QuickNode for testnet. Looks like there is not enough
// data on testnet to be able to target the very first blocks. So workaround this, we just shift
// everything by 20 to be able to use their API
const TESTNET_CONFIRMATION_TARGET = {
  [FeeRate.Fast]: 21,
  [FeeRate.Medium]: 22,
  [FeeRate.Slow]: 23,
};

export const NoFeeRateError = 'Insufficient data or no feerate found';

export class QuickNodeClient extends ApiClient implements IDataClient {
  apiClientName = 'QuickNodeClient';

  protected readonly _options: QuickNodeClientOptions;

  protected readonly _priorityMap: Record<FeeRate, number>;

  constructor(options: QuickNodeClientOptions) {
    super();
    const isMainnet = options.network === networks.bitcoin;

    this._options = options;
    this._priorityMap = isMainnet
      ? MAINNET_CONFIRMATION_TARGET
      : TESTNET_CONFIRMATION_TARGET;
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

  protected isErrorResponse<ApiResponse extends QuickNodeResponse>(
    response: ApiResponse,
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

  protected async getResponse<ApiResponse>(
    response: HttpResponse,
  ): Promise<ApiResponse> {
    // QuickNode returns 200 status code for successful requests, others are errors status code
    if (response.status !== 200) {
      const res = (await response.json()) as unknown as ApiResponse &
        QuickNodeResponse;
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `API response error: ${JSON.stringify(res.error)}`,
      );
    }

    if (!response.ok) {
      throw new Error(`HTTP response error: ${response.statusText}`);
    }

    // Safeguard to detect if the response is an error response, but they are not caught by the fetch error
    const apiResponse = (await response.json()) as unknown as ApiResponse &
      QuickNodeResponse;
    if (this.isErrorResponse(apiResponse)) {
      throw new Error(`Error response from quicknode`);
    }

    return apiResponse;
  }

  protected async submitJsonRPCRequest<ApiResponse>({
    request,
    responseStruct,
  }: {
    request: {
      method: string;
      params: Json;
    };
    responseStruct: Struct;
  }) {
    return await this.submitRequest<ApiResponse>({
      request: this.buildRequest({
        method: 'POST',
        url: this.baseUrl,
        body: request,
      }),
      responseStruct,
      requestId: request.method,
    });
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

    const {
      result: { mempoolminfee, minrelaytxfee },
    } = await this.getMempoolInfo();

    // keep this batch process in case we have to switch to support multiple fee rates.
    await processBatch(
      Object.entries(processItems),
      async ([feeRate, target]) => {
        const {
          result: { feerate, errors },
        } = await this.submitJsonRPCRequest<QuickNodeEstimateFeeResponse>({
          request: {
            method: 'estimatesmartfee',
            params: [target],
          },
          responseStruct: QuickNodeEstimateFeeResponseStruct,
        });

        // When the feerate data is unavailable,
        // the api response will look like:
        // {
        //   "result": {
        //     "errors": ['Insufficient data or no feerate found'],
        //     "blocks": 2
        //   },
        //   "error": null,
        //   "id": null
        // }
        // In that case, we will use the mempool min fee instead.
        if (
          Array.isArray(errors) &&
          errors.length === 1 &&
          errors[0] === NoFeeRateError
        ) {
          logger.warn(
            `The feerate is unavailable on target block ${target}, use mempool data 'mempoolminfee' instead`,
          );
        } else if (errors) {
          throw new DataClientError(
            `Failed to get fee rate from quicknode: ${JSON.stringify(errors)}`,
          );
        }

        // A safeguard to ensure the feerate is not reject by the chain with the min requirement by mempool
        const feeRateInBtcPerKvb = getMinimumFeeRateInKvb(
          feerate ?? 0,
          mempoolminfee,
          minrelaytxfee,
        );

        // The fee rate will be returned in BTC/kvB unit (note the kilobyte here)
        // e.g. 0.00005081
        // See: https://www.quicknode.com/docs/bitcoin/estimatesmartfee
        // > Estimates the smart fee per **kilobyte** ...
        feeRates[feeRate] = Number(
          satsKvbToVb(btcToSats(feeRateInBtcPerKvb.toString())),
        );
      },
    );

    return feeRates;
  }

  protected async getMempoolInfo(): Promise<QuickNodeGetMempoolResponse> {
    return await this.submitJsonRPCRequest<QuickNodeGetMempoolResponse>({
      request: {
        method: 'getmempoolinfo',
        params: [],
      },
      responseStruct: QuickNodeGetMempoolStruct,
    });
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
