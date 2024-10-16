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

jest.mock('../../../utils/logger');
jest.mock('../../../utils/snap');

describe('SimpleHashClient', () => {
  const createSimpleHashClient = () => {
    return new SimpleHashClient({
      apiKey: 'API-KEY',
    });
  };

  const createAccountAddresses = async (count: number) => {
    const network = networks.bitcoin;
    const accounts = await createAccounts(network, count);
    return accounts.map((account) => account.address);
  };

  describe('filterUtxos', () => {
    it('returns filtered utxos', async () => {
      const fetchSpy = createMockFetch();
      const addresses = await createAccountAddresses(5);

      const expectedUtxos: Utxo[] = [];

      for (const address of addresses) {
        const mockResponse = generateSimpleHashWalletAssetsByAddressResp(
          address,
          10,
        );
        for (const utxo of mockResponse.utxos) {
          const [txHash, vout] = utxo.output.split(':');
          expectedUtxos.push({
            txHash,
            index: parseInt(vout, 10),
            value: utxo.value,
            block: utxo.block_number,
          });
        }

        mockApiSuccessResponse({
          fetchSpy,
          mockResponse,
        });
      }

      const client = createSimpleHashClient();
      const result = await client.filterUtxos(addresses, []);

      expect(result).toStrictEqual(expectedUtxos);
      expect(fetchSpy).toHaveBeenCalledTimes(addresses.length);
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

    it('throws `Unexpected response from API client` if the api response is unexpected', async () => {
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
