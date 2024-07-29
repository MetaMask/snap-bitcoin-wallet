import type { KeyringAccount } from '@metamask/keyring-api';
import { InvalidParamsError } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import { v4 as uuidV4 } from 'uuid';

import { generateBlockChairGetUtxosResp } from '../../test/utils';
import { BtcOnChainService } from '../bitcoin/chain';
import { BtcAccountDeriver, BtcWallet } from '../bitcoin/wallet';
import { Config } from '../config';
import { Caip2ChainId } from '../constants';
import { AccountNotFoundError } from '../exceptions';
import { KeyringStateManager } from '../stateManagement';
import { btcToSats, satsToBtc } from '../utils';
import type { GetMaxSpendableBalanceParams } from './get-max-spendable-balance';
import { getMaxSpendableBalance } from './get-max-spendable-balance';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('GetMaxSpendableBalanceHandler', () => {
  describe('getMaxSpendableBalance', () => {
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
      return `m/0'/0/${index}`;
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
      minVal = 10000,
      maxVal = 100000,
    ) => {
      const mockResponse = generateBlockChairGetUtxosResp(
        address,
        counter,
        minVal,
        maxVal,
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

    it('returns the maximum spendable balance correctly', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, keyringAccount } = await createAccount(
        network,
        caip2ChainId,
      );
      const { data: utxoDataList, total: utxoTotalValue } =
        createMockGetDataForTransactionResp(
          sender.address,
          100,
          10000,
          10000000000,
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
            type: Config.defaultFeeRate,
            rate: BigInt(15),
          },
        ],
      });

      const result = await getMaxSpendableBalance({
        account: keyringAccount.id,
      });

      expect(result).toStrictEqual({
        fee: {
          amount: result.fee.amount,
          unit: 'BTC',
        },
        balance: {
          amount: result.balance.amount,
          unit: 'BTC',
        },
      });

      // If there are no UTXOs that meet the dust threshold, then the total balance should equal the sum of the fee and the spendable balance.
      expect(
        btcToSats(result.fee.amount) + btcToSats(result.balance.amount),
      ).toStrictEqual(BigInt(utxoTotalValue));
    });

    it('estimates the maximum spendable balance by excluding any UTXO whose value is equal to or less than the dust threshold', async () => {
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
      // when with 104 sats/byte, 1 input contains 63 bytes,
      // hence the dust threshold (fee of using this UTXO) will be 104 * 63 bytes = 6552 sats,
      // if an utxo less than this amount will be discard, as it is waste to use it
      const feeRate = 104;
      const discardVal = 63 * feeRate;
      utxoDataList[0].value = discardVal;
      const utxoTotalValue = utxoDataList.reduce(
        (acc, utxo) => acc + utxo.value,
        0,
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
            type: Config.defaultFeeRate,
            rate: BigInt(feeRate),
          },
        ],
      });

      const result = await getMaxSpendableBalance({
        account: keyringAccount.id,
      });

      // If there is a UTXO that meets the dust threshold, then the total balance should equal the sum of the fee, the spendable balance, and the value of the dust UTXO.
      expect(
        BigInt(utxoTotalValue) -
          (btcToSats(result.fee.amount) + btcToSats(result.balance.amount)),
      ).toStrictEqual(BigInt(discardVal));
    });

    it.each([
      {
        utxoCnt: 1,
        utxoVal: 200,
      },
      {
        utxoCnt: 0,
        utxoVal: 1,
      },
    ])(
      "returns 0 spendable balance if the account's balance is too small or the account does not have utxo",
      async ({ utxoCnt, utxoVal }: { utxoCnt: number; utxoVal: number }) => {
        const network = networks.testnet;
        const caip2ChainId = Caip2ChainId.Testnet;
        const { sender, keyringAccount } = await createAccount(
          network,
          caip2ChainId,
        );
        const { data: utxoDataList } = createMockGetDataForTransactionResp(
          sender.address,
          utxoCnt,
          utxoVal,
          utxoVal,
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
              type: Config.defaultFeeRate,
              rate: BigInt(1),
            },
          ],
        });

        const result = await getMaxSpendableBalance({
          account: keyringAccount.id,
        });

        expect(result).toStrictEqual({
          fee: {
            amount: satsToBtc(0),
            unit: 'BTC',
          },
          balance: {
            amount: satsToBtc(0),
            unit: 'BTC',
          },
        });
      },
    );

    it('throws `InvalidParamsError` when request parameter is not correct', async () => {
      await expect(
        getMaxSpendableBalance({} as unknown as GetMaxSpendableBalanceParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `AccountNotFoundError` if the account does not exist', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { getWalletSpy } = await createAccount(network, caip2ChainId);

      getWalletSpy.mockReset().mockResolvedValue(null);

      await expect(
        getMaxSpendableBalance({
          account: uuidV4(),
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `AccountNotFoundError` if the derived account if the derived account is not matching with the account from state', async () => {
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
        getMaxSpendableBalance({
          account: keyringAccount.id,
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `Failed to get max spendable balance` error if no fee rate is returned from the chain service', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { keyringAccount } = await createAccount(network, caip2ChainId);
      const { getFeeRatesSpy } = createMockChainApiFactory();
      getFeeRatesSpy.mockResolvedValue({
        fees: [],
      });

      await expect(
        getMaxSpendableBalance({
          account: keyringAccount.id,
        }),
      ).rejects.toThrow('Failed to get max spendable balance');
    });

    it('throws `Failed to get max spendable balance` error if another error was thrown during the estimation', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender } = await createAccount(network, caip2ChainId);
      const { data: utxoDataList } = createMockGetDataForTransactionResp(
        sender.address,
        1,
        10000,
        10000,
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
            type: Config.defaultFeeRate,
            rate: BigInt(1),
          },
        ],
      });
      jest
        .spyOn(BtcWallet.prototype, 'estimateFee')
        .mockRejectedValue(new Error('error'));

      await expect(
        getMaxSpendableBalance({
          account: uuidV4(),
        }),
      ).rejects.toThrow('Failed to get max spendable balance');
    });
  });
});
