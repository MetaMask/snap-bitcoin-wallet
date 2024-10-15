import { BtcP2wpkhAddressStruct } from '@metamask/keyring-api';
import { array, assert, type Struct } from 'superstruct';

import { processBatch } from '../../../utils';
import type { HttpHeader, HttpResponse } from '../api-client';
import { ApiClient, HttpMethod } from '../api-client';
import type { ISatsProtectionDataClient } from '../data-client';
import type { Utxo } from '../service';
import type {
  SimpleHashClientOptions,
  SimpleHashWalletAssetsByUtxoResponse,
} from './simplehash.types';
import { SimpleHashWalletAssetsByUtxoResponseStruct } from './simplehash.types';

export class SimpleHashClient
  extends ApiClient
  implements ISatsProtectionDataClient
{
  readonly apiClientName = 'SimpleHashClient';

  // Simplehash API does not support testnet, only mainnet is supported.
  // reference: https://docs.simplehash.com/reference/supported-chains-testnets
  readonly baseUrl = `https://api.simplehash.com/api/v0`;

  protected _options: SimpleHashClientOptions;

  constructor(options: SimpleHashClientOptions) {
    super();
    this._options = options;
  }

  protected getApiUrl(endpoint: string): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    return url.toString();
  }

  protected getHttpHeader(): HttpHeader {
    return {
      'X-API-KEY': this._options.apiKey,
    };
  }

  protected async getResponse<ApiResponse>(
    response: HttpResponse,
  ): Promise<ApiResponse> {
    // For successful requests, Simplehash will return a 200 status code.
    // Any other status code should be considered an error.
    if (response.status !== 200) {
      throw new Error(`API response error`);
    }

    return await super.getResponse<ApiResponse>(response);
  }

  protected async submitGetApiRequest<ApiResponse>({
    endpoint,
    responseStruct,
    requestId,
  }: {
    endpoint: string;
    responseStruct: Struct;
    requestId: string;
  }) {
    return await super.submitRequest<ApiResponse>({
      request: this.buildRequest({
        method: HttpMethod.Get,
        url: this.getApiUrl(endpoint),
        headers: this.getHttpHeader(),
      }),
      responseStruct,
      requestId,
    });
  }

  // An output is the combination of the transaction hash and the vout, serving as a unique identifier for an UTXO
  // e.g 123456789558bd40a14d1cc2f42f5e0476a34ab8589bdc84f65b4eb305b9b925:0
  // Transaction hash is the first part before the colon, and the index/vout is the second part after the colon.
  protected outputToTxHashNVout(output: string): [string, number] {
    const [txHash, vout] = output.split(':');
    return [txHash, parseInt(vout, 10)];
  }

  // The API returns UTXOs that does not contain inscriptions, raresats, and runes,
  // which eliminates the need for UTXO filtering.
  // As a result, the argument _utxos will be disregarded, and the UTXOs can be directly returned from this API.
  async filterUtxos(addresses: string[], _utxos: Utxo[]): Promise<Utxo[]> {
    // A safeguard to deduplicate the addresses and prevent duplicated utxos returned by the API.
    const uniqueAddresses = Array.from(new Set(addresses));

    assert(uniqueAddresses, array(BtcP2wpkhAddressStruct));

    const utxos: Utxo[] = [];

    await processBatch(uniqueAddresses, async (address: string) => {
      const result =
        await this.submitGetApiRequest<SimpleHashWalletAssetsByUtxoResponse>({
          endpoint: `/custom/wallet_assets_by_utxo/${address}?without_inscriptions_runes_raresats=1`,
          responseStruct: SimpleHashWalletAssetsByUtxoResponseStruct,
          requestId: 'wallet_assets_by_utxo',
        });

      for (const utxo of result.utxos) {
        const [txHash, vout] = this.outputToTxHashNVout(utxo.output);
        // The UTXO will not be duplicated,
        // therefore we are safe to store the UTXO into an array.
        utxos.push({
          txHash,
          index: vout,
          value: utxo.value,
          block: utxo.block_number,
        });
      }
    });

    return utxos;
  }
}
