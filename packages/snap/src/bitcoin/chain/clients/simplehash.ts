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
    // Simplehash only returns 200 status code for successful requests,
    // otherwise can consider as error.
    if (response.status !== 200) {
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `API response error`,
      );
    }
    return (await response.json()) as unknown as ApiResponse;
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

  // An output is the combination of tx hash and index as an unique identifier of an utxo
  // e.g 123456789558bd40a14d1cc2f42f5e0476a34ab8589bdc84f65b4eb305b9b925:0
  protected outputToTxHashNVout(output: string): [string, number] {
    const [txHash, vout] = output.split(':');
    return [txHash, parseInt(vout, 10)];
  }

  // The API will returns the utxos that does not contains inscriptions, raresats and runes,
  // thus we can skip the utxos filtering, and directly return the utxos from this API.
  // Hence, the argument _utxos will be ignored.
  async filterUtxos(addresses: string[], _utxos: Utxo[]): Promise<Utxo[]> {
    // A safeguard to deduplicate the addresses to prevent duplicated utxos returned by the API.
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
        // The utxo will not be duplicated,
        // as when create a transaction, it gives the utxo with an unique ID (Output/Outpoint).
        // Therefore we are safe to store the utxos with array.
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
