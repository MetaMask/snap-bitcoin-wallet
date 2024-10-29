import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import {
  generateAccounts,
  generateFormattedUtxos,
  generateQuickNodeSendRawTransactionResp,
} from '../../../test/utils';
import { Caip2Asset } from '../../constants';
import { FeeRate, TransactionStatus } from './constants';
import type { IDataClient, ISatsProtectionDataClient } from './data-client';
import { BtcOnChainServiceError } from './exceptions';
import { BtcOnChainService } from './service';

jest.mock('../../utils/logger');

describe('BtcOnChainService', () => {
  const createMockDataClient = () => {
    const getBalancesSpy = jest.fn();
    const getUtxosSpy = jest.fn();
    const getFeeRatesSpy = jest.fn();
    const getTransactionStatusSpy = jest.fn();
    const sendTransactionSpy = jest.fn();
    const filterUtxosSpy = jest.fn();

    class MockReadDataClient implements IDataClient {
      getBalances = getBalancesSpy;

      getUtxos = getUtxosSpy;

      getFeeRates = getFeeRatesSpy;

      getTransactionStatus = getTransactionStatusSpy;

      sendTransaction = sendTransactionSpy;
    }

    class MockSatsProtectionClient implements ISatsProtectionDataClient {
      filterUtxos = filterUtxosSpy;
    }

    return {
      dataClient: new MockReadDataClient(),
      satsProtectionClient: new MockSatsProtectionClient(),
      filterUtxosSpy,
      getBalancesSpy,
      getUtxosSpy,
      getFeeRatesSpy,
      getTransactionStatusSpy,
      sendTransactionSpy,
    };
  };

  const createMockBtcService = (
    dataClient?: IDataClient,
    satsProtectionClient?: ISatsProtectionDataClient,
    network: Network = networks.testnet,
    satsProtection = false,
  ) => {
    const {
      dataClient: _dataClient,
      satsProtectionClient: _satsProtectionDataClient,
    } = createMockDataClient();

    class MockBtcOnChainService extends BtcOnChainService {
      isSatsProtectionEnabled() {
        return super.isSatsProtectionEnabled();
      }
    }

    const isSatsProtectionEnabledSpy = jest.spyOn(
      MockBtcOnChainService.prototype,
      'isSatsProtectionEnabled',
    );

    const service = new MockBtcOnChainService(
      {
        dataClient: dataClient ?? _dataClient,
        satsProtectionDataClient:
          satsProtectionClient ?? _satsProtectionDataClient,
      },
      {
        network,
        satsProtection,
      },
    );

    return {
      isSatsProtectionEnabledSpy,
      service,
    };
  };

  describe('isSatsProtectionEnabled', () => {
    const prepareIsSatsProtectionEnabled = (
      network: Network = networks.testnet,
      isSatsProtectionEnabled = false,
    ) => {
      const { dataClient, satsProtectionClient } = createMockDataClient();

      const { service } = createMockBtcService(
        dataClient,
        satsProtectionClient,
        network,
        isSatsProtectionEnabled,
      );

      return {
        service,
      };
    };

    it.each([
      {
        network: networks.bitcoin,
        networkName: 'mainnet',
        satsProtection: true,
        expected: true,
      },
      {
        network: networks.bitcoin,
        networkName: 'mainnet',
        satsProtection: false,
        expected: false,
      },
      {
        network: networks.testnet,
        networkName: 'testnet',
        satsProtection: false,
        expected: false,
      },
      {
        network: networks.testnet,
        networkName: 'testnet',
        satsProtection: false,
        expected: false,
      },
    ])(
      'return $expected when: satsProtection - $satsProtection, network - $networkName',
      async ({ network, satsProtection, expected }) => {
        const { service } = prepareIsSatsProtectionEnabled(
          network,
          satsProtection,
        );

        expect(service.isSatsProtectionEnabled()).toBe(expected);
      },
    );
  });

  describe('getBalances', () => {
    const prepareGetBalances = (
      network: Network = networks.testnet,
      isSatsProtectionEnabled = false,
    ) => {
      const {
        dataClient,
        satsProtectionClient,
        getBalancesSpy,
        filterUtxosSpy,
      } = createMockDataClient();

      const { service, isSatsProtectionEnabledSpy } = createMockBtcService(
        dataClient,
        satsProtectionClient,
        network,
        isSatsProtectionEnabled,
      );

      const accounts = generateAccounts(10);
      const addresses = accounts.map((account) => account.address);
      let totalBalanceFromGetBalances = BigInt(0);
      let totalBalanceFromUtxos = BigInt(0);

      isSatsProtectionEnabledSpy.mockReturnValue(isSatsProtectionEnabled);

      getBalancesSpy.mockResolvedValue(
        addresses.reduce((acc, address) => {
          totalBalanceFromGetBalances += BigInt(1000);
          acc[address] = BigInt(1000);
          return acc;
        }, {}),
      );

      // As we are not returning the UTXOs per address,
      // we only need to simulate the UTXOs of the first address
      const utxos = generateFormattedUtxos(addresses[0], 2, 500, 500);
      filterUtxosSpy.mockResolvedValue(utxos);
      totalBalanceFromUtxos = utxos.reduce(
        (acc, utxo) => acc + BigInt(utxo.value),
        BigInt(0),
      );

      return {
        service,
        addresses,
        getBalancesSpy,
        filterUtxosSpy,
        totalBalanceFromGetBalances,
        totalBalanceFromUtxos,
      };
    };

    it('returns total balances if sats protection is disabled', async () => {
      const {
        service,
        addresses,
        getBalancesSpy,
        filterUtxosSpy,
        totalBalanceFromGetBalances,
      } = prepareGetBalances(networks.testnet, false);

      const result = await service.getBalances(addresses, [Caip2Asset.TBtc]);

      expect(getBalancesSpy).toHaveBeenCalledWith(addresses);
      expect(filterUtxosSpy).not.toHaveBeenCalled();

      expect(result).toStrictEqual({
        balances: {
          [Caip2Asset.TBtc]: {
            amount: totalBalanceFromGetBalances,
          },
        },
      });
    });

    it('returns sats protected balances if sats protection is enable', async () => {
      const {
        service,
        addresses,
        getBalancesSpy,
        filterUtxosSpy,
        totalBalanceFromUtxos,
      } = prepareGetBalances(networks.bitcoin, true);

      const result = await service.getBalances(addresses, [Caip2Asset.Btc]);

      expect(filterUtxosSpy).toHaveBeenCalledWith(addresses, []);
      expect(getBalancesSpy).not.toHaveBeenCalled();

      expect(result).toStrictEqual({
        balances: {
          [Caip2Asset.Btc]: {
            amount: totalBalanceFromUtxos,
          },
        },
      });
    });

    it('throws `Only one asset is supported` error if the given asset more than 1', async () => {
      const { service, addresses } = prepareGetBalances();

      await expect(
        service.getBalances(addresses, [Caip2Asset.TBtc, Caip2Asset.Btc]),
      ).rejects.toThrow('Only one asset is supported');
    });

    it.each([
      {
        assetName: 'BTC',
        asset: Caip2Asset.Btc,
        network: networks.testnet,
        networkName: 'testnet',
      },
      {
        assetName: 'TBTC',
        asset: Caip2Asset.TBtc,
        network: networks.bitcoin,
        networkName: 'mainnet',
      },
    ])(
      'throws `Invalid asset` error if the asset is $assetName and current network is $networkName',
      async ({ asset, network }) => {
        const { service, addresses } = prepareGetBalances(network);

        await expect(service.getBalances(addresses, [asset])).rejects.toThrow(
          'Invalid asset',
        );
      },
    );
  });

  describe('getUtxos', () => {
    const prepareGetUtxos = (
      network: Network = networks.testnet,
      isSatsProtectionEnabled = false,
    ) => {
      const { dataClient, satsProtectionClient, getUtxosSpy, filterUtxosSpy } =
        createMockDataClient();

      const { service, isSatsProtectionEnabledSpy } = createMockBtcService(
        dataClient,
        satsProtectionClient,
        network,
        isSatsProtectionEnabled,
      );

      const accounts = generateAccounts(2);
      const addresses = accounts.map((account) => account.address);
      isSatsProtectionEnabledSpy.mockReturnValue(isSatsProtectionEnabled);

      // As we are not returning the UTXOs per address,
      // we only need to simulate the UTXOs of the first address
      const utxos = generateFormattedUtxos(addresses[0], 10);

      getUtxosSpy.mockResolvedValue(utxos);
      filterUtxosSpy.mockResolvedValue(utxos);

      return {
        service,
        addresses,
        getUtxosSpy,
        filterUtxosSpy,
        utxos,
      };
    };

    it('returns all UTXOs if sats protection is disabled', async () => {
      const { service, addresses, getUtxosSpy, filterUtxosSpy, utxos } =
        prepareGetUtxos(networks.testnet, false);

      const result = await service.getDataForTransaction(addresses);

      expect(getUtxosSpy).toHaveBeenCalledWith(addresses);
      expect(filterUtxosSpy).not.toHaveBeenCalled();
      expect(result).toStrictEqual({
        data: {
          utxos,
        },
      });
    });

    it('returns protected UTXOs if sats protection is enabled', async () => {
      const { service, addresses, getUtxosSpy, filterUtxosSpy, utxos } =
        prepareGetUtxos(networks.bitcoin, true);

      const result = await service.getDataForTransaction(addresses);

      expect(filterUtxosSpy).toHaveBeenCalledWith(addresses, []);
      expect(getUtxosSpy).not.toHaveBeenCalled();
      expect(result).toStrictEqual({
        data: {
          utxos,
        },
      });
    });

    it('throws error if readClient fail', async () => {
      const { service, addresses, getUtxosSpy } = prepareGetUtxos();

      getUtxosSpy.mockRejectedValue(new Error('error'));

      await expect(service.getDataForTransaction(addresses)).rejects.toThrow(
        BtcOnChainServiceError,
      );
    });
  });

  describe('getFeeRates', () => {
    it('return getFeeRates result', async () => {
      const { dataClient, getFeeRatesSpy } = createMockDataClient();
      const { service } = createMockBtcService(dataClient);
      getFeeRatesSpy.mockResolvedValue({
        [FeeRate.Fast]: 1,
        [FeeRate.Medium]: 2,
      });

      const result = await service.getFeeRates();

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
      const { dataClient, getFeeRatesSpy } = createMockDataClient();
      const { service } = createMockBtcService(dataClient);

      getFeeRatesSpy.mockRejectedValue(new Error('error'));

      await expect(service.getFeeRates()).rejects.toThrow(
        BtcOnChainServiceError,
      );
    });
  });

  describe('broadcastTransaction', () => {
    const signedTransaction =
      '02000000000101ec81faa8b57add4c8fb3958dd8f04667f5cd829a7b94199f4400be9e52cda0760000000000ffffffff015802000000000000160014f80b562cbcbbfc97727043484c06cc5579963e8402473044022011ec3f7ea7a7cac7cb891a1ea498d94ca3cd082339b9b2620ba5421ca7cbdf3d022062f34411d6aa5335c2bd7ff4c940adb962e9509133b86a2d97996552fd811f2c012102ceea82614fdb14871ef881498c55c5dbdc24b4633d29b42040dd18b4285540f500000000';

    it('calls sendTransaction with writeClient', async () => {
      const { dataClient, sendTransactionSpy } = createMockDataClient();
      const { service } = createMockBtcService(dataClient);

      const resp = generateQuickNodeSendRawTransactionResp();
      sendTransactionSpy.mockResolvedValue(resp.result);

      const result = await service.broadcastTransaction(signedTransaction);

      expect(sendTransactionSpy).toHaveBeenCalledWith(signedTransaction);
      expect(result).toStrictEqual({
        transactionId: resp.result,
      });
    });

    it('throws BtcOnChainServiceErrorr if write client execute fail', async () => {
      const { dataClient, sendTransactionSpy } = createMockDataClient();
      const { service } = createMockBtcService(dataClient);
      sendTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        service.broadcastTransaction(signedTransaction),
      ).rejects.toThrow(BtcOnChainServiceError);
    });
  });

  describe('getTransactionStatus', () => {
    const txHash =
      '1cd985fc26a9b27d0b574739b908d5fe78e2297b24323a7f8c04526648dc9c08';

    it('return getTransactionStatus result', async () => {
      const { dataClient, getTransactionStatusSpy } = createMockDataClient();
      const { service } = createMockBtcService(dataClient);
      getTransactionStatusSpy.mockResolvedValue({
        status: TransactionStatus.Confirmed,
      });

      const result = await service.getTransactionStatus(txHash);

      expect(getTransactionStatusSpy).toHaveBeenCalledWith(txHash);
      expect(result).toStrictEqual({
        status: TransactionStatus.Confirmed,
      });
    });

    it('throws BtcOnChainServiceError error if another error was thrown', async () => {
      const { dataClient, getTransactionStatusSpy } = createMockDataClient();
      const { service } = createMockBtcService(dataClient);

      getTransactionStatusSpy.mockRejectedValue(new Error('error'));

      await expect(service.getTransactionStatus(txHash)).rejects.toThrow(
        BtcOnChainServiceError,
      );
    });
  });
});
