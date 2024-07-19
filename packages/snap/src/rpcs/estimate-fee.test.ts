import type { KeyringAccount } from '@metamask/keyring-api';
import { InvalidParamsError } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import { v4 as uuidV4 } from 'uuid';

import { generateBlockChairGetUtxosResp } from '../../test/utils';
import { BtcOnChainService, FeeRatio } from '../bitcoin/chain';
import {
  BtcAccountDeriver,
  BtcWallet,
  CoinSelectService,
  TxValidationError,
} from '../bitcoin/wallet';
import { Config } from '../config';
import { Caip2ChainId } from '../constants';
import { AccountNotFoundError } from '../exceptions';
import { KeyringStateManager } from '../stateManagement';
import { satsToBtc } from '../utils';
import type { EstimateFeeParams } from './estimate-fee';
import { estimateFee } from './estimate-fee';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('EstimateFeeHandler', () => {
  describe('estimateFee', () => {
    const createMockChainApiFactory = () => {
      const getFeeRatesSpy = jest.spyOn(
        BtcOnChainService.prototype,
        'getFeeRates',
      );
      const getDataForTransactionSpy = jest.spyOn(
        BtcOnChainService.prototype,
        'getDataForTransaction',
      );

      return {
        getDataForTransactionSpy,
        getFeeRatesSpy,
      };
    };

    const createMockDeriver = (network) => {
      return {
        instance: new BtcAccountDeriver(network),
      };
    };

    const getHdPath = (index: number) => {
      return `m/0'.0/${index}`;
    };

    const createAccount = async (network, caip2ChainId: string) => {
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const sender = await wallet.unlock(0, Config.wallet.defaultAccountType);
      const getWalletSpy = jest.spyOn(
        KeyringStateManager.prototype,
        'getWallet',
      );

      const keyringAccount = {
        type: sender.type,
        id: uuidV4(),
        address: sender.address,
        options: {
          scope: caip2ChainId,
          index: sender.index,
        },
        methods: ['btc_sendmany'],
      } as unknown as KeyringAccount;

      getWalletSpy.mockResolvedValue({
        account: keyringAccount,
        hdPath: getHdPath(sender.index),
        index: sender.index,
        scope: caip2ChainId,
      });

      return {
        sender,
        getWalletSpy,
        keyringAccount,
        wallet,
      };
    };

    const createMockGetDataForTransactionResp = (
      address: string,
      counter: number,
    ) => {
      const mockResponse = generateBlockChairGetUtxosResp(
        address,
        counter,
        100000,
        100000,
      );
      let total = 0;
      const data = mockResponse.data[address].utxo.map((utxo) => {
        const { value } = utxo;
        total += value;
        return {
          block: utxo.block_id,
          txHash: utxo.transaction_hash,
          index: utxo.index,
          value,
        };
      });

      return {
        data,
        total,
      };
    };

    const createMockCoinSelectService = () => {
      const coinSelectServiceSpy = jest.spyOn(
        CoinSelectService.prototype,
        'selectCoins',
      );

      return {
        coinSelectServiceSpy,
      };
    };

    it('returns fee correctly', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { coinSelectServiceSpy } = createMockCoinSelectService();
      const { sender, keyringAccount } = await createAccount(
        network,
        caip2ChainId,
      );
      const { data: utxoDataList } = createMockGetDataForTransactionResp(
        sender.address,
        10,
      );
      const { getDataForTransactionSpy, getFeeRatesSpy } =
        createMockChainApiFactory();
      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos: utxoDataList,
        },
      });
      getFeeRatesSpy.mockResolvedValue({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: BigInt(1),
          },
        ],
      });
      const expectedFee = 200;
      coinSelectServiceSpy.mockReturnValue({
        inputs: [],
        outputs: [],
        fee: expectedFee,
      });

      const result = await estimateFee({
        account: keyringAccount.id,
        amount: '0.0001',
      });

      expect(result).toStrictEqual({
        fee: {
          amount: expect.any(String),
          unit: 'BTC',
        },
      });

      expect(result.fee.amount).toBe(satsToBtc(expectedFee));
    });

    it('throws `InvalidParamsError` when request parameter is not correct', async () => {
      await expect(
        estimateFee({
          amount: '0.0001',
        } as unknown as EstimateFeeParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `AccountNotFoundError` if the account does not exist', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { getWalletSpy } = await createAccount(network, caip2ChainId);

      getWalletSpy.mockReset().mockResolvedValue(null);

      await expect(
        estimateFee({
          account: uuidV4(),
          amount: '0.0001',
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `AccountNotFoundError` if the derived account is not match with the state', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { getWalletSpy, keyringAccount, wallet, sender } =
        await createAccount(network, caip2ChainId);

      // force state manager to return an account with same hd index but different address, to reproduce an case that the derived account address is not match with the state data
      const unmatchAccount = await wallet.unlock(
        1,
        Config.wallet.defaultAccountType,
      );
      getWalletSpy.mockReset().mockResolvedValue({
        account: {
          ...keyringAccount,
          address: unmatchAccount.address,
        },
        hdPath: getHdPath(sender.index),
        index: sender.index,
        scope: caip2ChainId,
      });

      await expect(
        estimateFee({
          account: keyringAccount.id,
          amount: '0.0001',
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `Failed to estimate fee` error if no fee rate returns from chain service', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { keyringAccount } = await createAccount(network, caip2ChainId);
      const { getFeeRatesSpy } = createMockChainApiFactory();
      getFeeRatesSpy.mockResolvedValue({
        fees: [],
      });

      await expect(
        estimateFee({
          account: keyringAccount.id,
          amount: '0.0001',
        }),
      ).rejects.toThrow('Failed to estimate fee');
    });

    it('throws `Transaction amount too small` error if estimate amount is dust', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, keyringAccount } = await createAccount(
        network,
        caip2ChainId,
      );
      const { data: utxoDataList } = createMockGetDataForTransactionResp(
        sender.address,
        10,
      );
      const { getDataForTransactionSpy, getFeeRatesSpy } =
        createMockChainApiFactory();
      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos: utxoDataList,
        },
      });
      getFeeRatesSpy.mockResolvedValue({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: BigInt(1),
          },
        ],
      });

      await expect(
        estimateFee({
          account: keyringAccount.id,
          amount: satsToBtc(1),
        }),
      ).rejects.toThrow(new TxValidationError('Transaction amount too small'));
    });
  });
});
