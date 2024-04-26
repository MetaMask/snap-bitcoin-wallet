import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateBlockStreamAccountStats,
} from '../../../../../test/utils';
import * as asyncUtils from '../../../../utils/async';
import { DataClientError } from '../exceptions';
import { BlockStreamClient } from './blockstream';

jest.mock('../../../logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('BlockStreamClient', () => {
  const createMockFetch = () => {
    // eslint-disable-next-line no-restricted-globals
    Object.defineProperty(global, 'fetch', {
      writable: true,
    });

    const fetchSpy = jest.fn();
    // eslint-disable-next-line no-restricted-globals
    global.fetch = fetchSpy;

    return {
      fetchSpy,
    };
  };

  describe('baseUrl', () => {
    it('returns testnet network url', () => {
      const instance = new BlockStreamClient({ network: networks.testnet });
      expect(instance.baseUrl).toBe('https://blockstream.info/testnet/api');
    });

    it('returns mainnet network url', () => {
      const instance = new BlockStreamClient({ network: networks.bitcoin });
      expect(instance.baseUrl).toBe('https://blockstream.info/api');
    });

    it('throws `Invalid network` error if the given network is not support', () => {
      const instance = new BlockStreamClient({ network: networks.regtest });
      expect(() => instance.baseUrl).toThrow('Invalid network');
    });
  });

  describe('getBalances', () => {
    it('returns balances', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(60);
      const addresses = accounts.map((account) => account.address);
      const mockResponse = generateBlockStreamAccountStats(addresses);
      const expectedResult = {};
      mockResponse.forEach((data) => {
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(data),
        });
        expectedResult[data.address] =
          data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      });

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getBalances(addresses);

      expect(result).toStrictEqual(expectedResult);
    });

    it('assigns balance to 0 if it failed to fetch', async () => {
      const { fetchSpy } = createMockFetch();
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: '503',
      });
      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getBalances(addresses);

      expect(result).toStrictEqual({ [addresses[0]]: 0 });
    });

    it('throws DataClientError error if an non DataClientError catched', async () => {
      const asyncHelperSpy = jest.spyOn(asyncUtils, 'processBatch');
      asyncHelperSpy.mockRejectedValue(new Error('error'));
      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);

      const instance = new BlockStreamClient({ network: networks.testnet });

      await expect(instance.getBalances(addresses)).rejects.toThrow(
        DataClientError,
      );
    });
  });
});
