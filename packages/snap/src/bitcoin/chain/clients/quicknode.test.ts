import type { Json } from '@metamask/utils';
import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import {
  generateQNGetBalanceResp,
  generateQNEstimatefeeResp,
  generateQNGetUtxosResp,
  generateQNGetRawTransactionResp,
  generateQNSendRawTransactionResp,
} from '../../../../test/utils';
import { Config } from '../../../config';
import { btcToSats } from '../../../utils';
import * as asyncUtils from '../../../utils/async';
import type { BtcAccount } from '../../wallet';
import { BtcAccountDeriver, BtcWallet } from '../../wallet';
import { TransactionStatus } from '../constants';
import { DataClientError } from '../exceptions';
import { QuickNodeClient } from './quicknode';

jest.mock('../../../utils/logger');
jest.mock('../../../utils/snap');

describe('QuickNodeClient', () => {
  const testnetEndpoint = 'https://api.quicknode.com/testnet';
  const mainnetEndpoint = 'https://api.quicknode.com/mainnet';

  class MockQNClient extends QuickNodeClient {
    async post<Resp>(body: Json): Promise<Resp> {
      return super.post(body);
    }
  }

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

  const createQNClient = (network: Network) => {
    return new MockQNClient({
      network,
      testnetEndpoint,
      mainnetEndpoint,
    });
  };

  const mockApiError = ({
    fetchSpy,
    isOk = true,
    status = 200,
    statusText = 'error',
    errorResp = {
      result: null,
      error: {
        code: 1,
        message: 'some error',
      },
      id: null,
    },
  }: {
    fetchSpy: jest.SpyInstance;
    isOk?: boolean;
    status?: number;
    statusText?: string;
    errorResp?: Record<string, Json>;
  }) => {
    fetchSpy.mockResolvedValueOnce({
      ok: isOk,
      status,
      statusText,
      json: jest.fn().mockResolvedValue(errorResp),
    });
  };

  const mockApiSuccessResponse = ({
    fetchSpy,
    mockResponse,
  }: {
    fetchSpy: jest.SpyInstance;
    mockResponse: unknown;
  }) => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockResponse),
    });
  };

  describe('post', () => {
    it('executes a request', async () => {
      const { fetchSpy } = createMockFetch();

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse: true,
      });

      const postBody = {
        method: 'testmethod',
        params: [1],
      };

      const instance = createQNClient(networks.testnet);
      const result = await instance.post(postBody);

      expect(fetchSpy).toHaveBeenCalledWith(instance.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody),
      });
      expect(result).toBe(true);
    });

    it('throws `Failed to post data from quicknode` error if the http status is not 200', async () => {
      const { fetchSpy } = createMockFetch();

      mockApiError({
        fetchSpy,
        status: 500,
        isOk: true,
        errorResp: {
          error: 'api error',
        },
      });

      const postBody = {
        method: 'testmethod',
        params: [1],
      };

      const instance = createQNClient(networks.testnet);

      await expect(instance.post(postBody)).rejects.toThrow(
        'Failed to post data from quicknode: api error',
      );
    });

    it('throws `Failed to post data from quicknode` error if the `response.ok` is false', async () => {
      const { fetchSpy } = createMockFetch();

      mockApiError({
        fetchSpy,
        status: 200,
        statusText: 'api error',
        isOk: false,
      });

      const postBody = {
        method: 'testmethod',
        params: [1],
      };

      const instance = createQNClient(networks.testnet);

      await expect(instance.post(postBody)).rejects.toThrow(
        'Failed to post data from quicknode: api error',
      );
    });
  });

  describe('baseUrl', () => {
    it('returns the testnet api endpoint', () => {
      const instance = createQNClient(networks.testnet);

      expect(instance.baseUrl).toStrictEqual(testnetEndpoint);
    });

    it('returns the mainnet api endpoint', () => {
      const instance = createQNClient(networks.bitcoin);

      expect(instance.baseUrl).toStrictEqual(mainnetEndpoint);
    });

    it('throws `Invalid network` error if the given network is not support', () => {
      const instance = createQNClient(networks.regtest);

      expect(() => instance.baseUrl).toThrow('Invalid network');
    });
  });

  describe('getBalances', () => {
    it('returns balances', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const { accounts } = await createAccounts(network, 5);
      const addresses = accounts.map((account) => account.address);

      const expectedResult = {};
      for (const address of addresses) {
        const mockResponse = generateQNGetBalanceResp(address);

        expectedResult[address] = parseInt(mockResponse.result.balance, 10);

        mockApiSuccessResponse({
          fetchSpy,
          mockResponse,
        });
      }

      const instance = createQNClient(network);
      const result = await instance.getBalances(addresses);

      expect(result).toStrictEqual(expectedResult);
    });

    // This case should never happen, but to ensure the test is 100% covered, hence we mock the processBatch to not process any request
    it('assign 0 balance to address if the address cant be found in the hashmap', async () => {
      const network = networks.testnet;
      const { accounts } = await createAccounts(network, 5);
      const addresses = accounts.map((account) => account.address);

      jest.spyOn(asyncUtils, 'processBatch').mockReturnThis();

      const instance = createQNClient(network);
      const result = await instance.getBalances(addresses);

      expect(result).toStrictEqual(
        addresses.reduce((acc, address) => {
          acc[address] = 0;
          return acc;
        }, {}),
      );
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const { accounts } = await createAccounts(network, 5);
      const addresses = accounts.map((account) => account.address);

      mockApiError({
        fetchSpy,
      });

      const instance = createQNClient(network);

      await expect(instance.getBalances(addresses)).rejects.toThrow(
        DataClientError,
      );
    });
  });

  describe('getFeeRates', () => {
    it('returns fee rates', async () => {
      const { fetchSpy } = createMockFetch();
      const expectedFeeRate = 0.0001;
      const mockResponse = generateQNEstimatefeeResp({
        feerate: expectedFeeRate,
      });

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const instance = createQNClient(networks.testnet);
      const result = await instance.getFeeRates();

      expect(result).toStrictEqual({
        [Config.defaultFeeRate]: Number(btcToSats(expectedFeeRate.toString())),
      });
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      mockApiError({
        fetchSpy,
      });

      const instance = createQNClient(networks.testnet);

      await expect(instance.getFeeRates()).rejects.toThrow(DataClientError);
    });
  });

  describe('getUtxos', () => {
    it('returns utxos', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const {
        accounts: [{ address }],
      } = await createAccounts(network, 1);
      const mockResponse = generateQNGetUtxosResp({
        utxosCount: 10,
      });
      const expectedResult = mockResponse.result.map((utxo) => ({
        block: utxo.height,
        txHash: utxo.txid,
        index: utxo.vout,
        value: parseInt(utxo.value, 10),
      }));

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const instance = createQNClient(network);
      const result = await instance.getUtxos(address);

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const {
        accounts: [{ address }],
      } = await createAccounts(network, 1);

      mockApiError({
        fetchSpy,
      });

      const instance = createQNClient(network);

      await expect(instance.getUtxos(address)).rejects.toThrow(DataClientError);
    });
  });

  describe('getTransactionStatus', () => {
    const txid =
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

    it("returns `confirmed` if the transaction's confirmation number is >= 6", async () => {
      const { fetchSpy } = createMockFetch();

      const mockResponse = generateQNGetRawTransactionResp({
        txid,
        confirmations: 6,
      });

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const instance = createQNClient(networks.testnet);
      const result = await instance.getTransactionStatus(txid);

      expect(result).toStrictEqual({
        status: TransactionStatus.Confirmed,
      });
    });

    it("returns `pending` if the transaction's confirmation number is < 6", async () => {
      const { fetchSpy } = createMockFetch();

      const mockResponse = generateQNGetRawTransactionResp({
        txid,
        confirmations: 1,
      });

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const instance = createQNClient(networks.testnet);
      const result = await instance.getTransactionStatus(txid);

      expect(result).toStrictEqual({
        status: TransactionStatus.Pending,
      });
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      mockApiError({
        fetchSpy,
      });

      const instance = createQNClient(networks.testnet);

      await expect(instance.getTransactionStatus(txid)).rejects.toThrow(
        DataClientError,
      );
    });
  });

  describe('sendTransaction', () => {
    const signedTransaction =
      '02000000000101ec81faa8b57add4c8fb3958dd8f04667f5cd829a7b94199f4400be9e52cda0760000000000ffffffff015802000000000000160014f80b562cbcbbfc97727043484c06cc5579963e8402473044022011ec3f7ea7a7cac7cb891a1ea498d94ca3cd082339b9b2620ba5421ca7cbdf3d022062f34411d6aa5335c2bd7ff4c940adb962e9509133b86a2d97996552fd811f2c012102ceea82614fdb14871ef881498c55c5dbdc24b4633d29b42040dd18b4285540f500000000';

    it('broadcasts a transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateQNSendRawTransactionResp();
      const expectedResult = mockResponse.result.hex;

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const instance = createQNClient(networks.testnet);
      const result = await instance.sendTransaction(signedTransaction);

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      mockApiError({
        fetchSpy,
      });

      const instance = createQNClient(networks.testnet);

      await expect(instance.sendTransaction(signedTransaction)).rejects.toThrow(
        DataClientError,
      );
    });
  });
});
