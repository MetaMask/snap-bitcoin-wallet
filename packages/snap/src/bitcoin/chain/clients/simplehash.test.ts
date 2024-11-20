import { networks } from 'bitcoinjs-lib';
import { StructError } from 'superstruct';

import { generateSimpleHashWalletAssetsByAddressResp } from '../../../../test/utils';
import type { Utxo } from '../service';
import {
  createMockFetch,
  mockApiSuccessResponse,
  mockErrorResponse,
  createAccounts,
} from './__tests__/helper';
import { SimpleHashClient } from './simplehash';
import type { SimpleHashWalletAssetsByUtxoResponse } from './simplehash.types';

jest.mock('../../../utils/logger');
jest.mock('../../../utils/snap');

describe('SimpleHashClient', () => {
  class MockSimpleHashClient extends SimpleHashClient {
    public outputToTxHashAndVout(output: string): [string, number] {
      return super.outputToTxHashAndVout(output);
    }
  }

  const createSimpleHashClient = () => {
    return new MockSimpleHashClient({
      apiKey: 'API-KEY',
    });
  };

  const createAccountAddresses = async (count: number) => {
    const network = networks.bitcoin;
    const accounts = await createAccounts(network, count);
    return accounts.map((account) => account.address);
  };

  describe('filterUtxos', () => {
    const mockSuccessResponse = ({
      address,
      fetchSpy,
    }: {
      address: string;
      fetchSpy: jest.SpyInstance;
    }) => {
      const mockResponse = generateSimpleHashWalletAssetsByAddressResp(
        address,
        10,
      );

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      return mockResponse;
    };

    const extractUtxosFromApiResponse = ({
      apiResponse,
      client,
    }: {
      apiResponse: SimpleHashWalletAssetsByUtxoResponse;
      client: MockSimpleHashClient;
    }) => {
      return apiResponse.utxos.map((utxo) => {
        const [txHash, vout] = client.outputToTxHashAndVout(utxo.output);
        return {
          txHash,
          index: vout,
          value: utxo.value,
          block: utxo.block_number,
        };
      });
    };

    it('returns filtered utxos', async () => {
      const fetchSpy = createMockFetch();
      const addresses = await createAccountAddresses(5);
      const client = createSimpleHashClient();

      let expectedUtxos: Utxo[] = [];
      for (const address of addresses) {
        const mockResponse = mockSuccessResponse({
          address,
          fetchSpy,
        });
        expectedUtxos = expectedUtxos.concat(
          extractUtxosFromApiResponse({ apiResponse: mockResponse, client }),
        );
      }

      const result = await client.filterUtxos(addresses, []);

      expect(result).toStrictEqual(expectedUtxos);
      expect(fetchSpy).toHaveBeenCalledTimes(addresses.length);
    });

    it('deduplicates the query addresses to prevent duplicated UTXOs being returned', async () => {
      const fetchSpy = createMockFetch();
      const [address] = await createAccountAddresses(1);
      const client = createSimpleHashClient();

      const mockResponse = mockSuccessResponse({
        address,
        fetchSpy,
      });
      const expectedUtxos = extractUtxosFromApiResponse({
        apiResponse: mockResponse,
        client,
      });

      // Having duplicated addresses to test if the client deduplicates the addresses
      const addresses = [address, address, address];
      const result = await client.filterUtxos(addresses, []);

      expect(result).toStrictEqual(expectedUtxos);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws superstruct error if any of the given addresses is not a valid bitcoin address', async () => {
      const addresses = await createAccountAddresses(1);
      const client = createSimpleHashClient();

      await expect(
        client.filterUtxos([...addresses, 'invalid address'], []),
      ).rejects.toThrow(StructError);
    });

    it('throws `API response error` if the http status is not 200', async () => {
      const fetchSpy = createMockFetch();
      const addresses = await createAccountAddresses(1);

      mockErrorResponse({
        fetchSpy,
        status: 500,
      });

      const client = createSimpleHashClient();

      await expect(client.filterUtxos(addresses, [])).rejects.toThrow(
        `API response error`,
      );
    });

    it('throws `Unexpected response from API client` if the API response is unexpected', async () => {
      const fetchSpy = createMockFetch();
      const addresses = await createAccountAddresses(1);

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse: {
          invalidResponse: 'response',
        },
      });

      const client = createSimpleHashClient();

      await expect(client.filterUtxos(addresses, [])).rejects.toThrow(
        `Unexpected response from API client`,
      );
    });
  });
});
