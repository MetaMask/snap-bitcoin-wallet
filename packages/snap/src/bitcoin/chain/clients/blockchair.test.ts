import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateBlockChairBroadcastTransactionResp,
  generateBlockChairGetBalanceResp,
  generateBlockChairGetUtxosResp,
  generateBlockChairGetStatsResp,
  generateBlockChairTransactionDashboard,
} from '../../../../test/utils';
import { FeeRatio, TransactionStatus } from '../constants';
import { DataClientError } from '../exceptions';
import { BlockChairClient } from './blockchair';

jest.mock('../../../utils/logger');

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

  describe('getApiUrl', () => {
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

  describe('getFeeRates', () => {
    it('returns fee rate', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateBlockChairGetStatsResp();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getFeeRates();

      expect(result).toStrictEqual({
        [FeeRatio.Fast]:
          mockResponse.data.suggested_transaction_fee_per_byte_sat,
      });
    });

    it('throws DataClientError error if an non DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('error')),
      });

      const instance = new BlockChairClient({ network: networks.testnet });

      await expect(instance.getFeeRates()).rejects.toThrow(DataClientError);
    });

    it('throws DataClientError error if an DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue(null),
      });

      const instance = new BlockChairClient({ network: networks.testnet });

      await expect(instance.getFeeRates()).rejects.toThrow(DataClientError);
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
        txHash: utxo.transaction_hash,
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
            txHash: utxo.transaction_hash,
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

  describe('sendTransaction', () => {
    const signedTransaction =
      '02000000000101ec81faa8b57add4c8fb3958dd8f04667f5cd829a7b94199f4400be9e52cda0760000000000ffffffff015802000000000000160014f80b562cbcbbfc97727043484c06cc5579963e8402473044022011ec3f7ea7a7cac7cb891a1ea498d94ca3cd082339b9b2620ba5421ca7cbdf3d022062f34411d6aa5335c2bd7ff4c940adb962e9509133b86a2d97996552fd811f2c012102ceea82614fdb14871ef881498c55c5dbdc24b4633d29b42040dd18b4285540f500000000';

    it('broadcasts an transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateBlockChairBroadcastTransactionResp();
      const expectedResult = mockResponse.data;

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.sendTransaction(signedTransaction);

      expect(result).toStrictEqual(expectedResult.transaction_hash);
    });

    it('throws DataClientError error if an fetch response is falsely', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue(null),
      });

      const instance = new BlockChairClient({ network: networks.testnet });

      await expect(instance.sendTransaction(signedTransaction)).rejects.toThrow(
        DataClientError,
      );
    });

    it('conducts error message with response`s context if status is 400', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          data: null,
          context: {
            code: 400,
            error:
              'Invalid transaction. Error: Transaction already in block chain',
          },
        }),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      await expect(instance.sendTransaction(signedTransaction)).rejects.toThrow(
        'Failed to post data from blockchair: Invalid transaction. Error: Transaction already in block chain',
      );
    });
  });

  describe('getTransactionStatus', () => {
    const txHash =
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

    it('returns correct result for confirmed transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateBlockChairTransactionDashboard(
        txHash,
        200000,
        200002,
        true,
      );

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getTransactionStatus(txHash);

      expect(result).toStrictEqual({
        status: TransactionStatus.Confirmed,
      });
    });

    it('returns correct result for pending transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateBlockChairTransactionDashboard(
        txHash,
        200000,
        200002,
        false,
      );

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getTransactionStatus(txHash);

      expect(result).toStrictEqual({
        status: TransactionStatus.Pending,
      });
    });

    it('returns pending status if blockchair result is empty', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: [],
          context: {
            state: 200002,
          },
        }),
      });

      const instance = new BlockChairClient({ network: networks.testnet });
      const result = await instance.getTransactionStatus(txHash);

      expect(result).toStrictEqual({
        status: TransactionStatus.Pending,
      });
    });

    it('throws DataClientError error if an DataClientError catched', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue(null),
      });

      const instance = new BlockChairClient({ network: networks.testnet });

      await expect(instance.getTransactionStatus(txHash)).rejects.toThrow(
        DataClientError,
      );
    });
  });
});
