import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { generateAccounts } from '../../../../test/utils';
import { BtcAsset } from '../constants';
import type { IReadDataClient } from '../data-client';
import { BtcTransactionMgr } from './manager';

describe('BtcTransactionMgr', () => {
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

  const createMockBtcTransactionMgr = (
    readDataClient: IReadDataClient,
    network: Network = networks.testnet,
  ) => {
    const instance = new BtcTransactionMgr(readDataClient, {
      network,
    });

    return {
      instance,
    };
  };

  describe('getBalance', () => {
    it('calls getBalances with readClient', async () => {
      const { instance, getBalanceSpy } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcTransactionMgr(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);
      getBalanceSpy.mockResolvedValue(
        addresses.reduce((acc, address) => {
          acc[address] = 100;
          return acc;
        }, {}),
      );

      await txnMgr.getBalances(addresses, [BtcAsset.TBtc]);

      expect(getBalanceSpy).toHaveBeenCalledWith(addresses);
    });

    it('throws `Only one asset is supported` error if the given asset more than 1', async () => {
      const { instance } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcTransactionMgr(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txnMgr.getBalances(addresses, [BtcAsset.TBtc, BtcAsset.Btc]),
      ).rejects.toThrow('Only one asset is supported');
    });

    it('throws `Invalid asset` error if the BTC asset is given and current network is testnet network', async () => {
      const { instance } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcTransactionMgr(instance);
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txnMgr.getBalances(addresses, [BtcAsset.Btc]),
      ).rejects.toThrow('Invalid asset');
    });

    it('throws `Invalid asset` error if the TBTC asset is given and current network is bitcoin network', async () => {
      const { instance } = createMockReadDataClient();
      const { instance: txnMgr } = createMockBtcTransactionMgr(
        instance,
        networks.bitcoin,
      );
      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);

      await expect(
        txnMgr.getBalances(addresses, [BtcAsset.TBtc]),
      ).rejects.toThrow('Invalid asset');
    });
  });
});
