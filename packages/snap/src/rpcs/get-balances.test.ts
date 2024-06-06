import type { KeyringAccount } from '@metamask/keyring-api';
import { InvalidParamsError } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import { v4 as uuidv4 } from 'uuid';

import { generateAccounts } from '../../test/utils';
import { Network, ScriptType } from '../bitcoin/constants';
import {
  BtcAccountBip32Deriver,
  BtcWallet,
  BtcAmount,
} from '../bitcoin/wallet';
import { Config } from '../config';
import { Factory } from '../factory';
import { GetBalancesHandler } from './get-balances';

jest.mock('../libs/logger/logger');
jest.mock('../libs/snap/helpers');

describe('GetBalancesHandler', () => {
  const asset = Config.avaliableAssets[Config.chain][0];

  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const getBalancesSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        getFeeRates: jest.fn(),
        getBalances: getBalancesSpy,
        broadcastTransaction: jest.fn(),
        listTransactions: jest.fn(),
        getTransactionStatus: jest.fn(),
        getDataForTransaction: jest.fn(),
      });
      return {
        getBalancesSpy,
      };
    };

    const createMockDeriver = (network) => {
      const rootSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getRoot');
      const childSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getChild');

      return {
        instance: new BtcAccountBip32Deriver(network),
        rootSpy,
        childSpy,
      };
    };

    const createMockAccount = async (network, caip2ChainId) => {
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const sender = await wallet.unlock(0, ScriptType.P2wpkh);
      const keyringAccount = {
        type: sender.type,
        id: uuidv4(),
        address: sender.address,
        options: {
          scope: caip2ChainId,
          index: sender.index,
        },
        methods: ['btc_sendmany'],
      };

      const walletData = {
        account: keyringAccount as unknown as KeyringAccount,
        hdPath: sender.hdPath,
        index: sender.index,
        scope: caip2ChainId,
      };

      return {
        keyringAccount,
        walletData,
        sender,
      };
    };

    it('gets balances', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { getBalancesSpy } = createMockChainApiFactory();

      const { walletData } = await createMockAccount(network, caip2ChainId);

      const addresses = [walletData.account.address];
      const mockResp = {
        balances: addresses.reduce((acc, address) => {
          acc[address] = {
            [asset]: {
              amount: new BtcAmount(100),
            },
          };
          return acc;
        }, {}),
      };

      const expected = {
        [asset]: {
          amount: '0.00000100',
          unit: Config.unit[Config.chain],
        },
      };

      getBalancesSpy.mockResolvedValue(mockResp);

      const result = await GetBalancesHandler.getInstance(walletData).execute({
        scope: walletData.scope,
        assets: [asset],
      });

      expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [asset]);
      expect(result).toStrictEqual(expected);
    });

    it('gets balances of the request account only', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { getBalancesSpy } = createMockChainApiFactory();
      const accounts = generateAccounts(10);
      const { walletData } = await createMockAccount(network, caip2ChainId);

      const addresses = [walletData.account.address];
      const mockResp = {
        balances: [
          ...addresses,
          ...accounts.map((account) => account.address),
        ].reduce((acc, address) => {
          acc[address] = {
            [asset]: {
              amount: new BtcAmount(100),
            },
            'some-asset': {
              amount: new BtcAmount(100),
            },
          };
          return acc;
        }, {}),
      };

      const expected = {
        [asset]: {
          amount: '0.00000100',
          unit: Config.unit[Config.chain],
        },
      };

      getBalancesSpy.mockResolvedValue(mockResp);

      const result = await GetBalancesHandler.getInstance(walletData).execute({
        scope: Network.Testnet,
        assets: [asset],
      });

      expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [asset]);
      expect(result).toStrictEqual(expected);
    });

    it('throws `Fail to get the balances` when transaction status fetch failed', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { getBalancesSpy } = createMockChainApiFactory();
      const { walletData } = await createMockAccount(network, caip2ChainId);

      getBalancesSpy.mockRejectedValue(new Error('error'));

      await expect(
        GetBalancesHandler.getInstance(walletData).execute({
          scope: Network.Testnet,
          assets: [asset],
        }),
      ).rejects.toThrow(`Fail to get the balances`);
    });

    it('throws `Request params is invalid` when request parameter is not correct', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { walletData } = await createMockAccount(network, caip2ChainId);

      await expect(
        GetBalancesHandler.getInstance(walletData).execute({
          scope: Network.Testnet,
          assets: ['some-asset'],
        }),
      ).rejects.toThrow(InvalidParamsError);
    });
  });
});
