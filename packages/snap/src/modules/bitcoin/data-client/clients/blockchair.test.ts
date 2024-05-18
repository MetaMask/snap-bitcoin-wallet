import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateBlockChairGetBalanceResp,
  generateBlockChairGetUtxosResp,
} from '../../../../../test/utils';
import { DataClientError } from '../exceptions';
import { BlockChairClient } from './blockchair';

jest.mock('../../../logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('BlockChairClient', () => {
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
      const instance = new BlockChairClient({ network: networks.testnet });
      expect(instance.baseUrl).toBe(
        'https://api.blockchair.com/bitcoin/testnet',
      );
    });

    it('returns mainnet network url', () => {
      const instance = new BlockChairClient({ network: networks.bitcoin });
      expect(instance.baseUrl).toBe('https://api.blockchair.com/bitcoin');
    });

    it('throws `Invalid network` error if the given network is not support', () => {
      const instance = new BlockChairClient({ network: networks.regtest });
      expect(() => instance.baseUrl).toThrow('Invalid network');
    });
  });

  describe('get', () => {
    it('append api key to query url if option `apiKey` is present', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);
      const mockResponse = generateBlockChairGetBalanceResp(addresses);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({
        network: networks.testnet,
        apiKey: 'key',
      });
      await instance.getBalances(addresses);

      expect(fetchSpy).toHaveBeenCalledWith(
        `https://api.blockchair.com/bitcoin/testnet/addresses/balances?addresses=${addresses.join(
          ',',
        )}&key=key`,
        { method: 'GET' },
      );
    });

    it('does not append api key if option `apiKey` is absent', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);
      const mockResponse = generateBlockChairGetBalanceResp(addresses);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      await instance.getBalances(addresses);

      expect(fetchSpy).toHaveBeenCalledWith(
        `https://api.blockchair.com/bitcoin/testnet/addresses/balances?addresses=${addresses.join(
          ',',
        )}`,
        { method: 'GET' },
      );
    });
  });

  describe('getBalances', () => {
    it('returns balances', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(10);
      const addresses = accounts.map((account) => account.address);
      const mockResponse = generateBlockChairGetBalanceResp(addresses);
      const expectedResult = mockResponse.data;

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getBalances(addresses);

      expect(result).toStrictEqual(expectedResult);
    });

    it('assigns balance to 0 if account is not exist', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(2);
      const accountWithNoBalance = generateAccounts(1, 'notexist')[0];
      const addresses = accounts.map((account) => account.address);
      const mockResponse = generateBlockChairGetBalanceResp(addresses);

      const expectedResult = {
        ...mockResponse.data,
        [accountWithNoBalance.address]: 0,
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getBalances(
        addresses.concat(accountWithNoBalance.address),
      );

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError error if an non DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('error')),
      });

      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);

      const instance = new BlockChairClient({ network: networks.testnet });

      await expect(instance.getBalances(addresses)).rejects.toThrow(
        DataClientError,
      );
    });

    it('throws DataClientError error if an fetch response is falsely', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue(null),
      });

      const accounts = generateAccounts(1);
      const addresses = accounts.map((account) => account.address);

      const instance = new BlockChairClient({ network: networks.testnet });

      await expect(instance.getBalances(addresses)).rejects.toThrow(
        DataClientError,
      );
    });
  });

  describe('getUtxos', () => {
    it('returns utxos', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(1);
      const { address } = accounts[0];
      const mockResponse = generateBlockChairGetUtxosResp(address, 10);
      const expectedResult = mockResponse.data[address].utxo.map((utxo) => ({
        block: utxo.block_id,
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getUtxos(address);

      expect(result).toStrictEqual(expectedResult);
    });

    it('fetchs with pagination if utxos more than limit', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(1);
      const { address } = accounts[0];

      const pagesToTest = 3;
      const limit = 1000;
      let expectedResult: unknown[] = [];

      for (let i = 0; i < pagesToTest; i++) {
        const mockResponse = generateBlockChairGetUtxosResp(
          address,
          i === pagesToTest - 1 ? 0 : limit,
        );
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse),
        });
        expectedResult = expectedResult.concat(
          mockResponse.data[address].utxo.map((utxo) => ({
            block: utxo.block_id,
            txnHash: utxo.transaction_hash,
            index: utxo.index,
            value: utxo.value,
          })),
        );
      }

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getUtxos(address);

      expect(result).toStrictEqual(expectedResult);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('throws `Data not avaiable` error if given address not found from the result', async () => {
      const { fetchSpy } = createMockFetch();
      const accounts = generateAccounts(2);
      const requestAddress = accounts[0].address;
      const actualRespAddress = accounts[1].address;
      const mockResponse = generateBlockChairGetUtxosResp(actualRespAddress, 1);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });

      await expect(instance.getUtxos(requestAddress)).rejects.toThrow(
        `Data not avaiable`,
      );
    });
  });
});
