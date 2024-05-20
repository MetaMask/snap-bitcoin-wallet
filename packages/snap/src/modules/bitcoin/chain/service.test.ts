import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateBlockChairBroadcastTransactionResp,
} from '../../../../test/utils';
import { BtcAsset } from '../constants';
import type { IReadDataClient, IWriteDataClient } from '../data-client';
import { BtcOnChainServiceError } from './exceptions';
import { BtcOnChainService } from './service';

describe('BtcOnChainService', () => {
  const createMockReadDataClient = () => {
    const getBalanceSpy = jest.fn();

    class MockReadDataClient implements IReadDataClient {
      getBalances = getBalanceSpy;
    }
    return {
      instance: new MockReadDataClient(),
      getBalanceSpy,
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
