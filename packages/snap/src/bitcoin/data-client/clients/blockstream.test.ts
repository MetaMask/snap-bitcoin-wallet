import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateBlockStreamAccountStats,
  generateBlockStreamGetUtxosResp,
  generateBlockStreamEstFeeResp,
  generateBlockStreamTransactionStatusResp,
} from '../../../../test/utils';
import { FeeRatio, TransactionStatus } from '../../../chain';
import * as asyncUtils from '../../../utils/async';
import { DataClientError } from '../exceptions';
import { BlockStreamClient } from './blockstream';

jest.mock('../../../libs/logger/logger');

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

  describe('getFeeRates', () => {
    it('returns fee rate', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateBlockStreamEstFeeResp();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getFeeRates();

      expect(result).toStrictEqual({
        [FeeRatio.Fast]: Math.round(mockResponse['1']),
        [FeeRatio.Medium]: Math.round(mockResponse['25']),
        [FeeRatio.Slow]: Math.round(mockResponse['144']),
      });
    });

    it('throws DataClientError error if an non DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('error')),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });

      await expect(instance.getFeeRates()).rejects.toThrow(DataClientError);
    });

    it('throws DataClientError error if an DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue(null),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });

      await expect(instance.getFeeRates()).rejects.toThrow(DataClientError);
    });
  });

  describe('getUtxos', () => {
    it('returns utxos', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(1);
      const { address } = accounts[0];
      const mockResponse = generateBlockStreamGetUtxosResp(100);
      const expectedResult = mockResponse.map((utxo) => ({
        block: utxo.status.block_height,
        txHash: utxo.txid,
        index: utxo.vout,
        value: utxo.value,
      }));

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getUtxos(address);

      expect(result).toStrictEqual(expectedResult);
    });

    it('includes unconfirmed if includeUnconfirmed is true', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(1);
      const { address } = accounts[0];
      const mockConfirmedResponse = generateBlockStreamGetUtxosResp(100);
      const mockUnconfirmedResponse = generateBlockStreamGetUtxosResp(
        100,
        false,
      );
      const combinedResponse = mockConfirmedResponse.concat(
        mockUnconfirmedResponse,
      );
      const expectedResult = combinedResponse.map((utxo) => ({
        block: utxo.status.block_height,
        txHash: utxo.txid,
        index: utxo.vout,
        value: utxo.value,
      }));

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(combinedResponse),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getUtxos(address, true);

      expect(result).toStrictEqual(expectedResult);
    });

    it('filters unconfirmed utxos if includeUnconfirmed is true', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(1);
      const { address } = accounts[0];
      const mockConfirmedResponse = generateBlockStreamGetUtxosResp(100);
      const mockUnconfirmedResponse = generateBlockStreamGetUtxosResp(
        100,
        false,
      );
      const combinedResponse = mockConfirmedResponse.concat(
        mockUnconfirmedResponse,
      );
      const expectedResult = mockConfirmedResponse.map((utxo) => ({
        block: utxo.status.block_height,
        txHash: utxo.txid,
        index: utxo.vout,
        value: utxo.value,
      }));

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(combinedResponse),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getUtxos(address, false);

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError error if an non DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();
      fetchSpy.mockRejectedValue(new Error('error'));
      const accounts = generateAccounts(1);
      const { address } = accounts[0];

      const instance = new BlockStreamClient({ network: networks.testnet });

      await expect(instance.getUtxos(address)).rejects.toThrow(DataClientError);
    });
  });

  describe('getTransactionStatus', () => {
    const txHash =
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

    it('returns correct result for confirmed transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockTxStatusResponse = generateBlockStreamTransactionStatusResp(
        200000,
        true,
      );

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTxStatusResponse),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getTransactionStatus(txHash);

      expect(result).toStrictEqual({
        status: TransactionStatus.Confirmed,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns correct result for pending transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockTxStatusResponse = generateBlockStreamTransactionStatusResp(
        200000,
        false,
      );

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTxStatusResponse),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });
      const result = await instance.getTransactionStatus(txHash);

      expect(result).toStrictEqual({
        status: TransactionStatus.Pending,
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('throws DataClientError error if an DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue(null),
      });

      const instance = new BlockStreamClient({ network: networks.testnet });

      await expect(instance.getTransactionStatus(txHash)).rejects.toThrow(
        DataClientError,
      );
    });
  });
});
