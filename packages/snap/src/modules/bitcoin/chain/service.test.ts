import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateBlockChairBroadcastTransactionResp,
  generateBlockChairGetUtxosResp,
} from '../../../../test/utils';
import { FeeRatio } from '../../../chain';
import { BtcAsset } from '../constants';
import type { IReadDataClient, IWriteDataClient } from '../data-client';
import { BtcOnChainServiceError } from './exceptions';
import { BtcOnChainService } from './service';

jest.mock('../../logger/logger', () => ({
  logger: {
    info: jest.fn(),
  },
}));

describe('BtcOnChainService', () => {
  const createMockReadDataClient = () => {
    const getBalanceSpy = jest.fn();
    const getUtxosSpy = jest.fn();
    const getFeeRatesSpy = jest.fn();
    class MockReadDataClient implements IReadDataClient {
      getBalances = getBalanceSpy;

      getUtxos = getUtxosSpy;

      getFeeRates = getFeeRatesSpy;
    }

    return {
      instance: new MockReadDataClient(),
      getBalanceSpy,
      getUtxosSpy,
      getFeeRatesSpy,
    };
  };

  const createMockWriteDataClient = () => {
    const sendTransactionSpy = jest.fn();

    class MockWriteDataClient implements IWriteDataClient {
      sendTransaction = sendTransactionSpy;
    }
    return {
      instance: new MockWriteDataClient(),
      sendTransactionSpy,
    };
  };

  const createMockBtcService = (
    readDataClient?: IReadDataClient,
    writeDataClient?: IWriteDataClient,
    network: Network = networks.testnet,
  ) => {
    const instance = new BtcOnChainService(
      readDataClient ?? createMockReadDataClient().instance,
      writeDataClient ?? createMockWriteDataClient().instance,
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
      const { instance, getBalanceSpy } = createMockReadDataClient();
      const { instance: txnService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);
      getBalanceSpy.mockResolvedValue(
        addresses.reduce((acc, address) => {
          acc[address] = 100;
          return acc;
        }, {}),
      );

      await txnService.getBalances(addresses, [BtcAsset.TBtc]);

      expect(getBalanceSpy).toHaveBeenCalledWith(addresses);
    });

    it('throws `Only one asset is supported` error if the given asset more than 1', async () => {
      const { instance } = createMockReadDataClient();
      const { instance: txnService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txnService.getBalances(addresses, [BtcAsset.TBtc, BtcAsset.Btc]),
      ).rejects.toThrow('Only one asset is supported');
    });

    it('throws `Invalid asset` error if the BTC asset is given and current network is testnet network', async () => {
      const { instance } = createMockReadDataClient();
      const { instance: txnService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txnService.getBalances(addresses, [BtcAsset.Btc]),
      ).rejects.toThrow('Invalid asset');
    });

    it('throws `Invalid asset` error if the TBTC asset is given and current network is bitcoin network', async () => {
      const { instance } = createMockReadDataClient();
      const { instance: txnService } = createMockBtcService(
        instance,
        undefined,
        networks.bitcoin,
      );
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txnService.getBalances(addresses, [BtcAsset.TBtc]),
      ).rejects.toThrow('Invalid asset');
    });
  });

  describe('getUtxos', () => {
    it('calls getUtxos with readClient', async () => {
      const { instance, getUtxosSpy } = createMockReadDataClient();
      const { instance: txnService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const sender = accounts[0].address;
      const receiver = accounts[1].address;
      const mockResponse = generateBlockChairGetUtxosResp(sender, 10);
      const utxos = mockResponse.data[sender].utxo.map((utxo) => ({
        block: utxo.block_id,
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));

      getUtxosSpy.mockResolvedValue(utxos);

      const result = await txnService.getDataForTransaction(sender, {
        amounts: {
          [receiver]: 100,
        },
        subtractFeeFrom: [],
        replaceable: true,
      });

      expect(getUtxosSpy).toHaveBeenCalledWith(sender);
      expect(result).toStrictEqual({
        data: {
          utxos,
        },
      });
    });

    it('throws error if readClient fail', async () => {
      const { instance, getUtxosSpy } = createMockReadDataClient();
      const { instance: txnService } = createMockBtcService(instance);
      const accounts = generateAccounts(2);
      const sender = accounts[0].address;
      const receiver = accounts[1].address;

      getUtxosSpy.mockRejectedValue(new Error('error'));

      await expect(
        txnService.getDataForTransaction(sender, {
          amounts: {
            [receiver]: 100,
          },
          subtractFeeFrom: [],
          replaceable: true,
        }),
      ).rejects.toThrow(BtcOnChainServiceError);
    });
  });

  describe('estimateFees', () => {
    it('return estimateFees result', async () => {
      const { instance, getFeeRatesSpy } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcService(instance);
      getFeeRatesSpy.mockResolvedValue({
        [FeeRatio.Fast]: 1.1,
        [FeeRatio.Medium]: 1.2,
      });

      const result = await txnMgr.estimateFees();

      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: 1.1,
          },
          {
            type: FeeRatio.Medium,
            rate: 1.2,
          },
        ],
      });
    });

    it('throws BtcOnChainServiceError error if an error catched', async () => {
      const { instance, getFeeRatesSpy } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcService(instance);

      getFeeRatesSpy.mockRejectedValue(new Error('error'));

      await expect(txnMgr.estimateFees()).rejects.toThrow(
        BtcOnChainServiceError,
      );
    });
  });

  describe('boardcastTransaction', () => {
    const signedTransaction =
      '02000000000101ec81faa8b57add4c8fb3958dd8f04667f5cd829a7b94199f4400be9e52cda0760000000000ffffffff015802000000000000160014f80b562cbcbbfc97727043484c06cc5579963e8402473044022011ec3f7ea7a7cac7cb891a1ea498d94ca3cd082339b9b2620ba5421ca7cbdf3d022062f34411d6aa5335c2bd7ff4c940adb962e9509133b86a2d97996552fd811f2c012102ceea82614fdb14871ef881498c55c5dbdc24b4633d29b42040dd18b4285540f500000000';

    it('calls sendTransaction with writeClient', async () => {
      const { instance, sendTransactionSpy } = createMockWriteDataClient();
      const { instance: txnService } = createMockBtcService(
        undefined,
        instance,
      );

      const resp = generateBlockChairBroadcastTransactionResp();
      sendTransactionSpy.mockResolvedValue(resp.data.transaction_hash);

      const result = await txnService.boardcastTransaction(signedTransaction);

      expect(sendTransactionSpy).toHaveBeenCalledWith(signedTransaction);
      expect(result).toStrictEqual(resp.data.transaction_hash);
    });

    it('throws BtcOnChainServiceErrorr if write client execute fail', async () => {
      const { instance, sendTransactionSpy } = createMockWriteDataClient();
      const { instance: txnService } = createMockBtcService(
        undefined,
        instance,
      );
      sendTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        txnService.boardcastTransaction(signedTransaction),
      ).rejects.toThrow(BtcOnChainServiceError);
    });
  });
});
