import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateFormattedUtxos,
  generateQuickNodeSendRawTransactionResp,
} from '../../../test/utils';
import { Caip2Asset } from '../../constants';
import { FeeRate, TransactionStatus } from './constants';
import type { IDataClient } from './data-client';
import { BtcOnChainServiceError } from './exceptions';
import { BtcOnChainService } from './service';

jest.mock('../../utils/logger');

describe('BtcOnChainService', () => {
  const createMockDataClient = () => {
    const getBalanceSpy = jest.fn();
    const getUtxosSpy = jest.fn();
    const getFeeRatesSpy = jest.fn();
    const getTransactionStatusSpy = jest.fn();
    const sendTransactionSpy = jest.fn();

    class MockReadDataClient implements IDataClient {
      getBalances = getBalanceSpy;

      getUtxos = getUtxosSpy;

      getFeeRates = getFeeRatesSpy;

      getTransactionStatus = getTransactionStatusSpy;

      sendTransaction = sendTransactionSpy;
    }

    return {
      instance: new MockReadDataClient(),
      getBalanceSpy,
      getUtxosSpy,
      getFeeRatesSpy,
      getTransactionStatusSpy,
      sendTransactionSpy,
    };
  };

  const createMockBtcService = (
    dataClient?: IDataClient,
    network: Network = networks.testnet,
  ) => {
    const instance = new BtcOnChainService(
      dataClient ?? createMockDataClient().instance,
      {
        network,
      },
    );

    return {
      instance,
    };
  };

  describe('getBalance', () => {
    it('calls getBalances with readClient', async () => {
      const { instance, getBalanceSpy } = createMockDataClient();
      const { instance: txService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);
      getBalanceSpy.mockResolvedValue(
        addresses.reduce((acc, address) => {
          acc[address] = 100;
          return acc;
        }, {}),
      );

      const result = await txService.getBalances(addresses, [Caip2Asset.TBtc]);

      expect(getBalanceSpy).toHaveBeenCalledWith(addresses);

      Object.values(result.balances).forEach((assetBalances) => {
        expect(assetBalances).toStrictEqual({
          [Caip2Asset.TBtc]: {
            amount: BigInt(100),
          },
        });
      });
    });

    it('throws `Only one asset is supported` error if the given asset more than 1', async () => {
      const { instance } = createMockDataClient();
      const { instance: txService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txService.getBalances(addresses, [Caip2Asset.TBtc, Caip2Asset.Btc]),
      ).rejects.toThrow('Only one asset is supported');
    });

    it('throws `Invalid asset` error if the BTC asset is given and current network is testnet network', async () => {
      const { instance } = createMockDataClient();
      const { instance: txService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txService.getBalances(addresses, [Caip2Asset.Btc]),
      ).rejects.toThrow('Invalid asset');
    });

    it('throws `Invalid asset` error if the TBTC asset is given and current network is bitcoin network', async () => {
      const { instance } = createMockDataClient();
      const { instance: txService } = createMockBtcService(
        instance,
        networks.bitcoin,
      );
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txService.getBalances(addresses, [Caip2Asset.TBtc]),
      ).rejects.toThrow('Invalid asset');
    });
  });

  describe('getUtxos', () => {
    it('calls getUtxos with readClient', async () => {
      const { instance, getUtxosSpy } = createMockDataClient();
      const { instance: txService } = createMockBtcService(instance);
      const accounts = generateAccounts(1);
      const sender = accounts[0].address;
      const utxos = generateFormattedUtxos(sender, 10);

      getUtxosSpy.mockResolvedValue(utxos);

      const result = await txService.getDataForTransaction([sender]);

      expect(getUtxosSpy).toHaveBeenCalledWith([sender]);
      expect(result).toStrictEqual({
        data: {
          utxos,
        },
      });
    });

    it('throws error if readClient fail', async () => {
      const { instance, getUtxosSpy } = createMockDataClient();
      const { instance: txService } = createMockBtcService(instance);
      const accounts = generateAccounts(1);
      const sender = accounts[0].address;

      getUtxosSpy.mockRejectedValue(new Error('error'));

      await expect(txService.getDataForTransaction([sender])).rejects.toThrow(
        BtcOnChainServiceError,
      );
    });
  });

  describe('getFeeRates', () => {
    it('return getFeeRates result', async () => {
      const { instance, getFeeRatesSpy } = createMockDataClient();
      const { instance: txMgr } = createMockBtcService(instance);
      getFeeRatesSpy.mockResolvedValue({
        [FeeRate.Fast]: 1,
        [FeeRate.Medium]: 2,
      });

      const result = await txMgr.getFeeRates();

      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual({
        fees: [
          {
            type: FeeRate.Fast,
            rate: BigInt(1),
          },
          {
            type: FeeRate.Medium,
            rate: BigInt(2),
          },
        ],
      });
    });

    it('throws BtcOnChainServiceError error if another error was thrown', async () => {
      const { instance, getFeeRatesSpy } = createMockDataClient();
      const { instance: txMgr } = createMockBtcService(instance);

      getFeeRatesSpy.mockRejectedValue(new Error('error'));

      await expect(txMgr.getFeeRates()).rejects.toThrow(BtcOnChainServiceError);
    });
  });

  describe('broadcastTransaction', () => {
    const signedTransaction =
      '02000000000101ec81faa8b57add4c8fb3958dd8f04667f5cd829a7b94199f4400be9e52cda0760000000000ffffffff015802000000000000160014f80b562cbcbbfc97727043484c06cc5579963e8402473044022011ec3f7ea7a7cac7cb891a1ea498d94ca3cd082339b9b2620ba5421ca7cbdf3d022062f34411d6aa5335c2bd7ff4c940adb962e9509133b86a2d97996552fd811f2c012102ceea82614fdb14871ef881498c55c5dbdc24b4633d29b42040dd18b4285540f500000000';

    it('calls sendTransaction with writeClient', async () => {
      const { instance, sendTransactionSpy } = createMockDataClient();
      const { instance: txService } = createMockBtcService(instance);

      const resp = generateQuickNodeSendRawTransactionResp();
      sendTransactionSpy.mockResolvedValue(resp.result);

      const result = await txService.broadcastTransaction(signedTransaction);

      expect(sendTransactionSpy).toHaveBeenCalledWith(signedTransaction);
      expect(result).toStrictEqual({
        transactionId: resp.result,
      });
    });

    it('throws BtcOnChainServiceErrorr if write client execute fail', async () => {
      const { instance, sendTransactionSpy } = createMockDataClient();
      const { instance: txService } = createMockBtcService(instance);
      sendTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        txService.broadcastTransaction(signedTransaction),
      ).rejects.toThrow(BtcOnChainServiceError);
    });
  });

  describe('getTransactionStatus', () => {
    const txHash =
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

    it('return getTransactionStatus result', async () => {
      const { instance, getTransactionStatusSpy } = createMockDataClient();
      const { instance: txMgr } = createMockBtcService(instance);
      getTransactionStatusSpy.mockResolvedValue({
        status: TransactionStatus.Confirmed,
      });

      const result = await txMgr.getTransactionStatus(txHash);

      expect(getTransactionStatusSpy).toHaveBeenCalledWith(txHash);
      expect(result).toStrictEqual({
        status: TransactionStatus.Confirmed,
      });
    });

    it('throws BtcOnChainServiceError error if another error was thrown', async () => {
      const { instance, getTransactionStatusSpy } = createMockDataClient();
      const { instance: txMgr } = createMockBtcService(instance);

      getTransactionStatusSpy.mockRejectedValue(new Error('error'));

      await expect(txMgr.getTransactionStatus(txHash)).rejects.toThrow(
        BtcOnChainServiceError,
      );
    });
  });
});
