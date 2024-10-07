import type { Json } from '@metamask/utils';
import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import {
  generateQuickNodeGetBalanceResp,
  generateQuickNodeEstimatefeeResp,
  generateQuickNodeGetUtxosResp,
  generateQuickNodeGetRawTransactionResp,
  generateQuickNodeSendRawTransactionResp,
  generateQuickNodeMempoolResp,
} from '../../../../test/utils';
import { Config } from '../../../config';
import { btcToSats, logger, satsKVBToVB } from '../../../utils';
import * as asyncUtils from '../../../utils/async';
import type { BtcAccount } from '../../wallet';
import { BtcAccountDeriver, BtcWallet } from '../../wallet';
import { TransactionStatus } from '../constants';
import { DataClientError } from '../exceptions';
import { QuickNodeClient } from './quicknode';
import type {
  QuickNodeEstimateFeeResponse,
  QuickNodeResponse,
} from './quicknode.types';

jest.mock('../../../utils/logger');
jest.mock('../../../utils/snap');

describe('QuickNodeClient', () => {
  const testnetEndpoint = 'https://api.quicknode.com/testnet';
  const mainnetEndpoint = 'https://api.quicknode.com/mainnet';

  class MockQuickNodeClient extends QuickNodeClient {
    async post<Response extends QuickNodeResponse>(
      body: Json,
    ): Promise<Response> {
      return super.post(body);
    }

    getPriorityMap() {
      return this._priorityMap;
    }
  }

  const createMockFetch = () => {
    const fetchSpy = jest.fn();
    // eslint-disable-next-line no-restricted-globals
    Object.defineProperty(global, 'fetch', {
      // Allow `fetch` to be redefined in the global scope
      writable: true,
      value: fetchSpy,
    });

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

  const createQuickNodeClient = (network: Network) => {
    return new MockQuickNodeClient({
      network,
      testnetEndpoint,
      mainnetEndpoint,
    });
  };

  const mockErrorResponse = ({
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

      const mockResponse = true;
      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const postBody = {
        method: 'testmethod',
        params: [1],
      };

      const client = createQuickNodeClient(networks.testnet);
      const result = await client.post(postBody);

      expect(fetchSpy).toHaveBeenCalledWith(client.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postBody),
      });
      expect(result).toBe(mockResponse);
    });

    it('throws `Failed to post data from quicknode` error if the http status is not 200', async () => {
      const { fetchSpy } = createMockFetch();

      mockErrorResponse({
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

      const client = createQuickNodeClient(networks.testnet);

      await expect(client.post(postBody)).rejects.toThrow(
        'Failed to post data from quicknode: api error',
      );
    });

    it('throws `Failed to post data from quicknode` error if the `response.ok` is false', async () => {
      const { fetchSpy } = createMockFetch();

      mockErrorResponse({
        fetchSpy,
        status: 200,
        statusText: 'api error',
        isOk: false,
      });

      const postBody = {
        method: 'testmethod',
        params: [1],
      };

      const client = createQuickNodeClient(networks.testnet);

      await expect(client.post(postBody)).rejects.toThrow(
        'Failed to post data from quicknode: api error',
      );
    });
  });

  describe('baseUrl', () => {
    it('returns the testnet api endpoint', () => {
      const client = createQuickNodeClient(networks.testnet);

      expect(client.baseUrl).toStrictEqual(testnetEndpoint);
    });

    it('returns the mainnet api endpoint', () => {
      const client = createQuickNodeClient(networks.bitcoin);

      expect(client.baseUrl).toStrictEqual(mainnetEndpoint);
    });

    it('throws `Invalid network` error if the given network is not supported', () => {
      const client = createQuickNodeClient(networks.regtest);

      expect(() => client.baseUrl).toThrow('Invalid network');
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
        const mockResponse = generateQuickNodeGetBalanceResp(address);

        expectedResult[address] = parseInt(mockResponse.result.balance, 10);

        mockApiSuccessResponse({
          fetchSpy,
          mockResponse,
        });
      }

      const client = createQuickNodeClient(network);
      const result = await client.getBalances(addresses);

      expect(result).toStrictEqual(expectedResult);
    });

    // This case should never happen, but to ensure the test is 100% covered, hence we mock the processBatch to not process any request
    it('assigns 0 balance to the address if it cannot be found in the hashmap', async () => {
      const network = networks.testnet;
      const { accounts } = await createAccounts(network, 5);
      const addresses = accounts.map((account) => account.address);

      jest.spyOn(asyncUtils, 'processBatch').mockReturnThis();

      const client = createQuickNodeClient(network);
      const result = await client.getBalances(addresses);

      const expectedEmptyBalances = addresses.reduce((acc, address) => {
        acc[address] = 0;
        return acc;
      }, {});

      expect(result).toStrictEqual(expectedEmptyBalances);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const { accounts } = await createAccounts(network, 5);
      const addresses = accounts.map((account) => account.address);

      mockErrorResponse({
        fetchSpy,
      });

      const client = createQuickNodeClient(network);

      await expect(client.getBalances(addresses)).rejects.toThrow(
        DataClientError,
      );
    });
  });

  describe('getFeeRates', () => {
    const mockEstimateFeeRate = ({
      fetchSpy,
      mempoolminfee = 0.0001,
      minrelaytxfee = 0.0001,
      smartFee,
      estimateFeeErrors = [],
    }: {
      fetchSpy: jest.SpyInstance;
      mempoolminfee?: number;
      minrelaytxfee?: number;
      smartFee?: number;
      estimateFeeErrors?: string[];
    }) => {
      const mockMempoolInfo = generateQuickNodeMempoolResp({
        mempoolminfee,
        minrelaytxfee,
      });
      const mockEstmateFeeResponse = generateQuickNodeEstimatefeeResp({
        feerate: smartFee,
      });
      // Mock Mempool Info Response
      mockApiSuccessResponse({
        fetchSpy,
        mockResponse: mockMempoolInfo,
      });

      let estimateFeeResponse: QuickNodeEstimateFeeResponse =
        mockEstmateFeeResponse;
      if (estimateFeeErrors && estimateFeeErrors.length > 0) {
        estimateFeeResponse = {
          ...mockEstmateFeeResponse,
          result: {
            ...mockEstmateFeeResponse.result,
            errors: estimateFeeErrors,
          },
        };
      }

      // Mock Estimate Fee Response
      mockApiSuccessResponse({
        fetchSpy,
        mockResponse: estimateFeeResponse,
      });
    };

    it('returns fee rates', async () => {
      const { fetchSpy } = createMockFetch();
      const expectedFeeRateKVB = 0.0002;
      mockEstimateFeeRate({
        fetchSpy,
        smartFee: expectedFeeRateKVB,
      });

      const client = createQuickNodeClient(networks.testnet);
      const result = await client.getFeeRates();

      expect(result).toStrictEqual({
        [Config.defaultFeeRate]: Number(
          satsKVBToVB(btcToSats(expectedFeeRateKVB.toString())),
        ),
      });
    });

    it('does not throws error if the feerate is unavailable', async () => {
      const { fetchSpy } = createMockFetch();
      const mempoolminfee = 0.0001;
      const minrelaytxfee = 0.0001;

      mockEstimateFeeRate({
        fetchSpy,
        smartFee: undefined,
        minrelaytxfee,
        mempoolminfee,
        estimateFeeErrors: ['Insufficient data or no feerate found'],
      });

      const client = createQuickNodeClient(networks.testnet);
      const target = client.getPriorityMap()[Config.defaultFeeRate];
      const result = await client.getFeeRates();

      expect(logger.warn).toHaveBeenCalledWith(
        `The feerate is unavailable on target block ${target}, use mempool data 'mempoolminfee' instead`,
      );
      expect(result).toStrictEqual({
        [Config.defaultFeeRate]: Number(
          satsKVBToVB(btcToSats(minrelaytxfee.toString())),
        ),
      });
    });

    it('throws error if the feerate is unavailable and the api response is unexpected', async () => {
      const { fetchSpy } = createMockFetch();
      mockEstimateFeeRate({
        fetchSpy,
        smartFee: undefined,
        estimateFeeErrors: ['Unexpected error'],
      });

      const client = createQuickNodeClient(networks.testnet);

      await expect(client.getFeeRates()).rejects.toThrow(DataClientError);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      mockErrorResponse({
        fetchSpy,
      });

      const client = createQuickNodeClient(networks.testnet);

      await expect(client.getFeeRates()).rejects.toThrow(DataClientError);
    });
  });

  describe('getUtxos', () => {
    it('returns utxos', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const {
        accounts: [{ address }],
      } = await createAccounts(network, 1);
      const mockResponse = generateQuickNodeGetUtxosResp({
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

      const client = createQuickNodeClient(network);
      const result = await client.getUtxos(address);

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const {
        accounts: [{ address }],
      } = await createAccounts(network, 1);

      mockErrorResponse({
        fetchSpy,
      });

      const client = createQuickNodeClient(network);

      await expect(client.getUtxos(address)).rejects.toThrow(DataClientError);
    });
  });

  describe('getTransactionStatus', () => {
    const txid =
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

    it.each([
      Config.defaultConfirmationThreshold,
      Config.defaultConfirmationThreshold + 1,
    ])(
      "returns `confirmed` if the transaction's confirmation number is $s",
      async (confirmations: number) => {
        const { fetchSpy } = createMockFetch();

        const mockResponse = generateQuickNodeGetRawTransactionResp({
          txid,
          confirmations,
        });

        mockApiSuccessResponse({
          fetchSpy,
          mockResponse,
        });

        const client = createQuickNodeClient(networks.testnet);
        const result = await client.getTransactionStatus(txid);

        expect(result).toStrictEqual({
          status: TransactionStatus.Confirmed,
        });
      },
    );

    it(`returns 'pending' if the transaction's confirmation number is < ${Config.defaultConfirmationThreshold}`, async () => {
      const { fetchSpy } = createMockFetch();

      const mockResponse = generateQuickNodeGetRawTransactionResp({
        txid,
        confirmations: Config.defaultConfirmationThreshold - 1,
      });

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const client = createQuickNodeClient(networks.testnet);
      const result = await client.getTransactionStatus(txid);

      expect(result).toStrictEqual({
        status: TransactionStatus.Pending,
      });
    });

    it(`returns 'pending' if the transaction's confirmation number is undefined`, async () => {
      const { fetchSpy } = createMockFetch();

      const mockResponse = generateQuickNodeGetRawTransactionResp({
        txid,
        confirmations: undefined,
      });

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const client = createQuickNodeClient(networks.testnet);
      const result = await client.getTransactionStatus(txid);

      expect(result).toStrictEqual({
        status: TransactionStatus.Pending,
      });
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      mockErrorResponse({
        fetchSpy,
      });

      const client = createQuickNodeClient(networks.testnet);

      await expect(client.getTransactionStatus(txid)).rejects.toThrow(
        DataClientError,
      );
    });
  });

  describe('sendTransaction', () => {
    const signedTransaction =
      '02000000000101ec81faa8b57add4c8fb3958dd8f04667f5cd829a7b94199f4400be9e52cda0760000000000ffffffff015802000000000000160014f80b562cbcbbfc97727043484c06cc5579963e8402473044022011ec3f7ea7a7cac7cb891a1ea498d94ca3cd082339b9b2620ba5421ca7cbdf3d022062f34411d6aa5335c2bd7ff4c940adb962e9509133b86a2d97996552fd811f2c012102ceea82614fdb14871ef881498c55c5dbdc24b4633d29b42040dd18b4285540f500000000';

    it('broadcasts a transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateQuickNodeSendRawTransactionResp();
      const expectedResult = mockResponse.result;

      mockApiSuccessResponse({
        fetchSpy,
        mockResponse,
      });

      const client = createQuickNodeClient(networks.testnet);
      const result = await client.sendTransaction(signedTransaction);

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      mockErrorResponse({
        fetchSpy,
      });

      const client = createQuickNodeClient(networks.testnet);

      await expect(client.sendTransaction(signedTransaction)).rejects.toThrow(
        DataClientError,
      );
    });
  });
});
