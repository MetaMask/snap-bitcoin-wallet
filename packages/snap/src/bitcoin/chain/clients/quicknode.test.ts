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
import type { BtcAccount } from '../../wallet';
import { BtcAccountDeriver, BtcWallet } from '../../wallet';
import { TransactionStatus } from '../constants';
import { DataClientError } from '../exceptions';
import { QuicknodeClient } from './quicknode';

jest.mock('../../../utils/logger');
jest.mock('../../../utils/snap');

describe('QuicknodeClient', () => {
  const testnetEndpoint = 'https://api.quicknode.com/testnet';
  const mainnetEndpoint = 'https://api.quicknode.com/mainnet';

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

  const createMockDeriver = (network) => {
    return {
      instance: new BtcAccountDeriver(network),
    };
  };

  const createAccounts = async (network, recipientCnt: number) => {
    const { instance } = createMockDeriver(network);
    const wallet = new BtcWallet(instance, network);

    const accounts: BtcAccount[] = [];
    for (let i = 0; i < recipientCnt; i++) {
      accounts.push(await wallet.unlock(i, Config.wallet.defaultAccountType));
    }

    return {
      accounts,
    };
  };

  const createQNClient = (network: Network) => {
    return new QuicknodeClient({
      network,
      testnetEndpoint,
      mainnetEndpoint,
    });
  };

  describe('baseUrl', () => {
    it('returns testnet network url', () => {
      const instance = createQNClient(networks.testnet);

      expect(instance.baseUrl).toStrictEqual(testnetEndpoint);
    });

    it('returns mainnet network url', () => {
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
      const jsonSpy = jest.fn();

      const expectedResult = {};
      for (const address of addresses) {
        const mockResponse = generateQNGetBalanceResp(address);

        expectedResult[address] = parseInt(mockResponse.result.balance, 10);

        fetchSpy.mockResolvedValue({
          ok: true,
          status: 200,
          json: jsonSpy.mockReturnValueOnce(mockResponse),
        });
      }

      const instance = createQNClient(network);
      const result = await instance.getBalances(addresses);

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();
      const network = networks.testnet;
      const { accounts } = await createAccounts(network, 5);
      const addresses = accounts.map((account) => account.address);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(null),
      });

      const instance = createQNClient(network);

      await expect(instance.getBalances(addresses)).rejects.toThrow(
        DataClientError,
      );
    });
  });

  describe('getFeeRates', () => {
    it('returns fee rate', async () => {
      const { fetchSpy } = createMockFetch();
      const expectedFeeRate = 0.0001;
      const mockResponse = generateQNEstimatefeeResp({
        feerate: expectedFeeRate,
      });

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = createQNClient(networks.testnet);
      const result = await instance.getFeeRates();

      expect(result).toStrictEqual({
        [Config.defaultFeeRate]: Number(btcToSats(expectedFeeRate.toString())),
      });
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
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

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
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

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
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

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
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

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = createQNClient(networks.testnet);
      const result = await instance.getTransactionStatus(txid);

      expect(result).toStrictEqual({
        status: TransactionStatus.Pending,
      });
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
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

    it('broadcasts an transaction', async () => {
      const { fetchSpy } = createMockFetch();
      const mockResponse = generateQNSendRawTransactionResp();
      const expectedResult = mockResponse.result.hex;

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const instance = createQNClient(networks.testnet);
      const result = await instance.sendTransaction(signedTransaction);

      expect(result).toStrictEqual(expectedResult);
    });

    it('throws DataClientError if the api response is invalid', async () => {
      const { fetchSpy } = createMockFetch();

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({}),
      });

      const instance = createQNClient(networks.testnet);

      await expect(instance.sendTransaction(signedTransaction)).rejects.toThrow(
        DataClientError,
      );
    });
  });
});
