import ecc from '@bitcoinerlab/secp256k1';
import type { SLIP10NodeInterface } from '@metamask/key-tree';
import type { KeyringAccount } from '@metamask/keyring-api';
import { InvalidParamsError } from '@metamask/snaps-sdk';
import { BIP32Factory } from 'bip32';
import { networks } from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import { v4 as uuidv4 } from 'uuid';

import { generateAccounts } from '../../test/utils';
import { Config } from '../config';
import { Factory } from '../factory';
import { BtcAsset, Network, ScriptType } from '../modules/bitcoin/constants';
import { BtcAccountBip32Deriver, BtcWallet } from '../modules/bitcoin/wallet';
import { BtcAmount } from '../modules/bitcoin/wallet/amount';
import { SnapHelper } from '../modules/snap';
import { GetBalancesHandler } from './get-balances';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GetBalancesHandler', () => {
  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const getBalancesSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        getFeeRates: jest.fn(),
        getBalances: getBalancesSpy,
        broadcastTransaction: jest.fn(),
        listTransactions: jest.fn(),
        getTransaction: jest.fn(),
        getDataForTransaction: jest.fn(),
      });
      return {
        getBalancesSpy,
      };
    };

    const createMockBip32Instance = (network) => {
      const ECPair = ECPairFactory(ecc);
      const bip32 = BIP32Factory(ecc);

      const keyPair = ECPair.makeRandom();
      const deriver = bip32.fromSeed(keyPair.publicKey, network);

      const jsonData = {
        privateKey: deriver.privateKey?.toString('hex'),
        publicKey: deriver.publicKey.toString('hex'),
        chainCode: deriver.chainCode.toString('hex'),
        depth: deriver.depth,
        index: deriver.index,
        curve: 'secp256k1',
        masterFingerprint: undefined,
        parentFingerprint: 0,
      };
      jest.spyOn(SnapHelper, 'getBip32Deriver').mockResolvedValue({
        ...jsonData,
        chainCodeBytes: deriver.chainCode,
        privateKeyBytes: deriver.privateKey,
        publicKeyBytes: deriver.publicKey,
        toJSON: jest.fn().mockReturnValue(jsonData),
      } as unknown as SLIP10NodeInterface);

      const rootSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getRoot');
      const childSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getChild');

      return {
        instance: new BtcAccountBip32Deriver(network),
        rootSpy,
        childSpy,
      };
    };

    const createMockAccount = async (network, caip2Network) => {
      const { instance } = createMockBip32Instance(network);
      const wallet = new BtcWallet(instance, network);
      const sender = await wallet.unlock(0, ScriptType.P2wpkh);
      const keyringAccount = {
        type: sender.type,
        id: uuidv4(),
        address: sender.address,
        options: {
          scope: caip2Network,
          index: sender.index,
        },
        methods: ['btc_sendmany'],
      };

      const walletData = {
        account: keyringAccount as unknown as KeyringAccount,
        hdPath: sender.hdPath,
        index: sender.index,
        scope: caip2Network,
      };

      return {
        keyringAccount,
        walletData,
        sender,
      };
    };

    it('gets balances', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { getBalancesSpy } = createMockChainApiFactory();

      const { walletData } = await createMockAccount(network, caip2Network);

      const addresses = [walletData.account.address];
      const mockResp = {
        balances: addresses.reduce((acc, address) => {
          acc[address] = {
            [BtcAsset.TBtc]: {
              amount: new BtcAmount(100),
            },
          };
          return acc;
        }, {}),
      };

      const expected = {
        [BtcAsset.TBtc]: {
          amount: '0.00000100',
          unit: Config.unit[Config.chain],
        },
      };

      getBalancesSpy.mockResolvedValue(mockResp);

      const result = await GetBalancesHandler.getInstance(walletData).execute({
        scope: walletData.scope,
        assets: [BtcAsset.TBtc],
      });

      expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [BtcAsset.TBtc]);
      expect(result).toStrictEqual(expected);
    });

    it('gets balances of the request account only', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { getBalancesSpy } = createMockChainApiFactory();
      const accounts = generateAccounts(10);
      const { walletData } = await createMockAccount(network, caip2Network);

      const addresses = [walletData.account.address];
      const mockResp = {
        balances: [
          ...addresses,
          ...accounts.map((account) => account.address),
        ].reduce((acc, address) => {
          acc[address] = {
            [BtcAsset.TBtc]: {
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
        [BtcAsset.TBtc]: {
          amount: '0.00000100',
          unit: Config.unit[Config.chain],
        },
      };

      getBalancesSpy.mockResolvedValue(mockResp);

      const result = await GetBalancesHandler.getInstance(walletData).execute({
        scope: Network.Testnet,
        assets: [BtcAsset.TBtc],
      });

      expect(getBalancesSpy).toHaveBeenCalledWith(addresses, [BtcAsset.TBtc]);
      expect(result).toStrictEqual(expected);
    });

    it('throws `Request params is invalid` when request parameter is not correct', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { walletData } = await createMockAccount(network, caip2Network);

      await expect(
        GetBalancesHandler.getInstance(walletData).execute({
          scope: Network.Testnet,
          assets: ['some-asset'],
        }),
      ).rejects.toThrow(InvalidParamsError);
    });
  });
});
