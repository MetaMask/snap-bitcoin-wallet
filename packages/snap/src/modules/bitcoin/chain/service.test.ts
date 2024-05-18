import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateBlockChairGetUtxosResp,
} from '../../../../test/utils';
import { BtcAsset } from '../constants';
import type { IReadDataClient } from '../data-client';
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

    class MockReadDataClient implements IReadDataClient {
      getBalances = getBalanceSpy;

      getUtxos = getUtxosSpy;
    }
    return {
      instance: new MockReadDataClient(),
      getBalanceSpy,
      getUtxosSpy,
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
      const { instance: txnService } = createMockBtcService(
        instance,
        networks.bitcoin,
      );
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
});
