import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { generateAccounts } from '../../../../test/utils';
import { FeeRatio } from '../../chain';
import { BtcAsset } from '../constants';
import type { IReadDataClient } from '../data-client';
import { BtcOnChainServiceError } from './exceptions';
import { BtcOnChainService } from './service';

describe('BtcOnChainService', () => {
  const createMockReadDataClient = () => {
    const getBalanceSpy = jest.fn();
    const getFeeRatesSpy = jest.fn();
    class MockReadDataClient implements IReadDataClient {
      getBalances = getBalanceSpy;

      getFeeRates = getFeeRatesSpy;
    }
    return {
      instance: new MockReadDataClient(),
      getBalanceSpy,
      getFeeRatesSpy,
    };
  };

  const createMockBtcService = (
    readDataClient: IReadDataClient,
    network: Network = networks.testnet,
  ) => {
    const instance = new BtcOnChainService(readDataClient, {
      network,
    });

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
        networks.bitcoin,
      );
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txnService.getBalances(addresses, [BtcAsset.TBtc]),
      ).rejects.toThrow('Invalid asset');
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
      const { instance: txnMgr } = createMockBtcService(
        instance,
        networks.bitcoin,
      );

      getFeeRatesSpy.mockRejectedValue(new Error('error'));

      await expect(txnMgr.estimateFees()).rejects.toThrow(
        BtcOnChainServiceError,
      );
    });
  });
});
