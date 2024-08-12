import { InvalidParamsError } from '@metamask/snaps-sdk';
import { v4 as uuidV4 } from 'uuid';

import { CoinSelectService, TxValidationError } from '../bitcoin/wallet';
import { Caip2ChainId } from '../constants';
import { AccountNotFoundError } from '../exceptions';
import { satsToBtc } from '../utils';
import { EstimateFeeTest } from './__test__/helper';
import type { EstimateFeeParams } from './estimate-fee';
import { estimateFee } from './estimate-fee';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('EstimateFeeHandler', () => {
  describe('estimateFee', () => {
    const prepareEstimateFee = async (
      caip2ChainId: string,
      feeRate = 1,
      utxoCount = 10,
      utxoMinVal = 100000,
      utxoMaxVal = 100000,
    ) => {
      const testHelper = new EstimateFeeTest({
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

    it('returns fee correctly', async () => {
      const { testHelper } = await prepareEstimateFee(Caip2ChainId.Testnet);

      const coinSelectServiceSpy = jest.spyOn(
        CoinSelectService.prototype,
        'selectCoins',
      );

      const expectedFee = 200;
      coinSelectServiceSpy.mockReturnValue({
        inputs: [],
        outputs: [],
        fee: expectedFee,
      });

      const result = await estimateFee({
        account: testHelper.keyringAccount.id,
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

    it('throws `InvalidParamsError` when the request parameter is not correct', async () => {
      await expect(
        estimateFee({
          amount: '0.0001',
        } as unknown as EstimateFeeParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `AccountNotFoundError` if the account does not exist', async () => {
      const { testHelper } = await prepareEstimateFee(Caip2ChainId.Testnet);
      await testHelper.createAccountNotFoundTest();

      await expect(
        estimateFee({
          account: uuidV4(),
          amount: '0.0001',
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `AccountNotFoundError` if the derived account is not matching with the account from state', async () => {
      const { testHelper } = await prepareEstimateFee(Caip2ChainId.Testnet);
      await testHelper.createAccountNotMatchTest();

      await expect(
        estimateFee({
          account: testHelper.keyringAccount.id,
          amount: '0.0001',
        }),
      ).rejects.toThrow(AccountNotFoundError);
    });

    it('throws `Failed to estimate fee` error if no fee rate is returned from the chain service', async () => {
      const { testHelper } = await prepareEstimateFee(Caip2ChainId.Testnet);
      await testHelper.createNoFeeAvailableTest();

      await expect(
        estimateFee({
          account: testHelper.keyringAccount.id,
          amount: '0.0001',
        }),
      ).rejects.toThrow('Failed to estimate fee');
    });

    it('throws `Transaction amount too small` error if amount to estimate for is considered dust', async () => {
      const { testHelper } = await prepareEstimateFee(Caip2ChainId.Testnet);

      await expect(
        estimateFee({
          account: testHelper.keyringAccount.id,
          amount: satsToBtc(1),
        }),
      ).rejects.toThrow(new TxValidationError('Transaction amount too small'));
    });
  });
});
