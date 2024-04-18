import { networks } from 'bitcoinjs-lib';

import blocksteamData from '../../../../../test/fixtures/blockstream.json';
import { generateAccounts } from '../../../../../test/utils';
import { DataClientError } from '../exceptions';
import { BlockStreamClient } from './blockstream';

jest.mock('../../../logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('BlockStreamClient', () => {
  const createMockFetch = () => {
    const fetchSpy = fetch as jest.Mock;
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

  describe('getBalance', () => {
    it('returns balances', async () => {
      const { fetchSpy } = createMockFetch();
      fetchSpy.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(blocksteamData.accountInfo),
      });
      const account = generateAccounts(1)[0];

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getBalance(account.address);

      const confirmed =
        blocksteamData.accountInfo.chain_stats.funded_txo_sum -
        blocksteamData.accountInfo.chain_stats.spent_txo_sum;
      const unconfirmed =
        blocksteamData.accountInfo.mempool_stats.funded_txo_sum -
        blocksteamData.accountInfo.mempool_stats.spent_txo_sum;

      expect(result).toStrictEqual({
        confirmed,
        unconfirmed,
        total: confirmed + unconfirmed,
      });
    });

    it('throws `503` error if fetch status is 503', async () => {
      const { fetchSpy } = createMockFetch();
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: '503',
      });
      const account = generateAccounts(1)[0];

      const instance = new BlockStreamClient({ network: networks.testnet });

      await expect(instance.getBalance(account.address)).rejects.toThrow(
        'Failed to fetch data from blockstream: 503',
      );
    });

    it('throws DataClientError error if an non DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();
      fetchSpy.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('error')),
      });
      const account = generateAccounts(1)[0];

      const instance = new BlockStreamClient({ network: networks.testnet });

      await expect(instance.getBalance(account.address)).rejects.toThrow(
        DataClientError,
      );
    });
  });
});
