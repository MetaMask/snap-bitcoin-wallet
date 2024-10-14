import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { generateSimpleHashWalletAssetsByAddressResp } from '../../../../test/utils';
import { Config } from '../../../config';
import type { BtcAccount } from '../../wallet';
import { BtcAccountDeriver, BtcWallet } from '../../wallet';
import type { Utxo } from '../service';
import {
  createMockFetch,
  mockApiSuccessResponse,
  mockErrorResponse,
} from './__tests__/helper';
import { SimpleHashClient } from './simplehash';

jest.mock('../../../utils/logger');
jest.mock('../../../utils/snap');

describe('SimpleHashClient', () => {
  class MockSimpleHashClient extends SimpleHashClient {}

  const createAccounts = async (network: Network, recipientCnt: number) => {
    const wallet = new BtcWallet(new BtcAccountDeriver(network), network);

    const accounts: BtcAccount[] = [];
    for (let i = 0; i < recipientCnt; i++) {
      accounts.push(await wallet.unlock(i, Config.wallet.defaultAccountType));
    }

    return {
      accounts,
    };
  };

  const createSimpleHashClient = () => {
    return new MockSimpleHashClient({
      apiKey: 'API-KEY',
    });
  };

  const reateAccountAddresses = async (count: number) => {
    const network = networks.bitcoin;
    const { accounts } = await createAccounts(network, count);
    return accounts.map((account) => account.address);
  };

  describe('filterUtxos', () => {
    it('returns filtered utxos', async () => {
      const { fetchSpy } = createMockFetch();
      const addresses = await reateAccountAddresses(5);

      const utxoSet: Set<Utxo> = new Set();

      for (const address of addresses) {
        const mockResponse = generateSimpleHashWalletAssetsByAddressResp(
          address,
          10,
        );
        for (const utxo of mockResponse.utxos) {
          const [txHash, vout] = utxo.output.split(':');
          // using a set to avoid duplicate utxos
          utxoSet.add({
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

      expect(result).toStrictEqual(Array.from(utxoSet));
      expect(fetchSpy).toHaveBeenCalledTimes(addresses.length);
    });

    it('throws `Api response error` if the http status is not 200', async () => {
      const { fetchSpy } = createMockFetch();
      const addresses = await reateAccountAddresses(1);

      mockErrorResponse({
        fetchSpy,
        status: 500,
      });

      const client = createSimpleHashClient();

      await expect(client.filterUtxos(addresses, [])).rejects.toThrow(
        `Api response error`,
      );
    });

    it('throws `Unexpected response from Api client` if the api response is unexpected', async () => {
      const { fetchSpy } = createMockFetch();
      const addresses = await reateAccountAddresses(1);

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse: {
          invalidResponse: 'response',
        },
      });

      const client = createSimpleHashClient();

      await expect(client.filterUtxos(addresses, [])).rejects.toThrow(
        `Unexpected response from Api client`,
      );
    });
  });
});
