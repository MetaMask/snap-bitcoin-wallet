import { InvalidParamsError } from '@metamask/snaps-sdk';
import { v4 as uuidV4 } from 'uuid';

import { BtcWallet } from '../bitcoin/wallet';
import { Caip2ChainId } from '../constants';
import { AccountNotFoundError } from '../exceptions';
import { btcToSats, satsToBtc } from '../utils';
import { GetMaxSpendableBalanceTest } from './__tests__/helper';
import type { GetMaxSpendableBalanceParams } from './get-max-spendable-balance';
import { getMaxSpendableBalance } from './get-max-spendable-balance';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('GetMaxSpendableBalanceHandler', () => {
  describe('getMaxSpendableBalance', () => {
    const prepareGetMaxSpendableBalance = async (
      caip2ChainId: string,
      feeRate = 1,
      utxoCount = 10,
      utxoMinVal = 100000,
      utxoMaxVal = 100000,
    ) => {
      const testHelper = new GetMaxSpendableBalanceTest({
        caip2ChainId,
        utxoCount,
        utxoMinVal,
        utxoMaxVal,
        feeRate,
      });
      await testHelper.setup();

      return {
        testHelper,
      };
    };

    it('returns the maximum spendable balance correctly', async () => {
      const { testHelper } = await prepareGetMaxSpendableBalance(
        Caip2ChainId.Testnet,
      );

      const result = await getMaxSpendableBalance({
        account: testHelper.keyringAccount.id,
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

      // If all UTXOs are above the dust threshold, then the total balance should be equal to the sum of the fee and the spendable balance.
      expect(
        btcToSats(result.fee.amount) + btcToSats(result.balance.amount),
      ).toStrictEqual(BigInt(testHelper.utxos.total));
    });

    it('estimates the maximum spendable balance by excluding any UTXO whose value is equal to or less than the dust threshold', async () => {
      const feeRate = 104;
      const { testHelper } = await prepareGetMaxSpendableBalance(
        Caip2ChainId.Testnet,
        feeRate,
        100,
        10000,
        10000000000,
      );

      // When using 104 satoshis per byte and 1 input contains 63 bytes, the dust threshold (fee for using this UTXO) will be 104 * 63 bytes = 6552 satoshis. Any UTXO less than this amount will be discarded as it would be a waste to use it.
      const utxoInputBytesSize = 63;
      const dustThreshold = utxoInputBytesSize * feeRate;
      // We set the first UTXO to be the dust threshold and re-calculate the total.
      testHelper.utxos.total =
        testHelper.utxos.total - testHelper.utxos.list[0].value + dustThreshold;
      testHelper.utxos.list[0].value = dustThreshold;

      const result = await getMaxSpendableBalance({
        account: testHelper.keyringAccount.id,
      });

      // One of our UTXO was below the dust threshold, then the total balance will not count this UTXO, thus we need to subtract it from the total UTXO balance.
      expect(
        btcToSats(result.fee.amount) + btcToSats(result.balance.amount),
      ).toStrictEqual(BigInt(testHelper.utxos.total) - BigInt(dustThreshold));
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
      "returns a zero-spendable-balance if the account's balance is too small or the account does not have UTXO",
      async ({ utxoCnt, utxoVal }: { utxoCnt: number; utxoVal: number }) => {
        const { testHelper } = await prepareGetMaxSpendableBalance(
          Caip2ChainId.Testnet,
          1,
          utxoCnt,
          utxoVal,
          utxoVal,
        );

        const result = await getMaxSpendableBalance({
          account: testHelper.keyringAccount.id,
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

    it('throws `InvalidParamsError` when the request parameter is not correct', async () => {
      await expect(
        getMaxSpendableBalance({} as unknown as GetMaxSpendableBalanceParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `AccountNotFoundError` if the account does not exist', async () => {
      const { testHelper } = await prepareGetMaxSpendableBalance(
        Caip2ChainId.Testnet,
      );
      await testHelper.createAccountNotFoundTest();

      await expect(
        getMaxSpendableBalance({
          account: uuidV4(),
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `AccountNotFoundError` if the derived account if the derived account is not matching with the account from state', async () => {
      const { testHelper } = await prepareGetMaxSpendableBalance(
        Caip2ChainId.Testnet,
      );
      await testHelper.createAccountNotMatchTest();

      await expect(
        getMaxSpendableBalance({
          account: testHelper.keyringAccount.id,
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `Failed to get max spendable balance` error if no fee rate is returned from the chain service', async () => {
      const { testHelper } = await prepareGetMaxSpendableBalance(
        Caip2ChainId.Testnet,
      );
      await testHelper.createNoFeeAvailableTest();

      await expect(
        getMaxSpendableBalance({
          account: testHelper.keyringAccount.id,
        }),
      ).rejects.toThrow('Failed to get max spendable balance');
    });

    it('throws `Failed to get max spendable balance` error if another error was thrown during the estimation', async () => {
      const { testHelper } = await prepareGetMaxSpendableBalance(
        Caip2ChainId.Testnet,
      );
      jest
        .spyOn(BtcWallet.prototype, 'estimateFee')
        .mockRejectedValue(new Error('error'));

      await expect(
        getMaxSpendableBalance({
          account: testHelper.keyringAccount.id,
        }),
      ).rejects.toThrow('Failed to get max spendable balance');
    });
  });
});
