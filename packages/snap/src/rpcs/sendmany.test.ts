import {
  InvalidParamsError,
  UserRejectedRequestError,
} from '@metamask/snaps-sdk';

import type { BtcAccount } from '../bitcoin/wallet';
import { TxValidationError } from '../bitcoin/wallet';
import { Caip2ChainId } from '../constants';
import { getExplorerUrl, shortenAddress, satsToBtc } from '../utils';
import * as snapUtils from '../utils/snap';
import { SendManyTest } from './__test__/helper';
import { type SendManyParams, sendMany } from './sendmany';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('SendManyHandler', () => {
  describe('sendMany', () => {
    const origin = 'http://localhost:3000';

    const createSendManyParams = (
      recipients: BtcAccount[],
      caip2ChainId: string,
      dryrun: boolean,
      comment = '',
    ): SendManyParams => {
      return {
        amounts: recipients.reduce((acc, recipient) => {
          acc[recipient.address] = satsToBtc(500);
          return acc;
        }, {}),
        comment,
        subtractFeeFrom: [],
        replaceable: false,
        dryrun,
        scope: caip2ChainId,
      } as unknown as SendManyParams;
    };

    const prepareSendMany = async (
      caip2ChainId: string,
      recipientCnt = 10,
      feeRate = 1,
      utxoCount = 10,
      utxoMinVal = 100000,
      utxoMaxVal = 100000,
    ) => {
      const testHelper = new SendManyTest({
        caip2ChainId,
        utxoCount,
        utxoMinVal,
        utxoMaxVal,
        feeRate,
        recipientCnt,
      });
      await testHelper.setup();

      const snapHelperSpy = jest.spyOn(snapUtils, 'confirmDialog');
      snapHelperSpy.mockResolvedValue(true);

      return {
        testHelper,
        snapHelperSpy,
      };
    };

    it('returns correct result', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId);

      const result = await sendMany(
        testHelper.sender,
        origin,
        createSendManyParams(testHelper.recipients, caip2ChainId, false),
      );

      expect(result).toStrictEqual({ txId: testHelper.broadCastTxResp });
      expect(testHelper.getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(testHelper.getDataForTransactionSpy).toHaveBeenCalledTimes(1);
      expect(testHelper.broadcastTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast transaction if in dryrun mode', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId);

      await sendMany(
        testHelper.sender,
        origin,
        createSendManyParams(testHelper.recipients, caip2ChainId, true),
      );

      expect(testHelper.broadcastTransactionSpy).toHaveBeenCalledTimes(0);
    });

    it('does create comment component in dialog if consumer has provide the comment', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper, snapHelperSpy } = await prepareSendMany(caip2ChainId);

      await sendMany(
        testHelper.sender,
        origin,
        createSendManyParams(
          testHelper.recipients,
          caip2ChainId,
          true,
          'test comment',
        ),
      );

      const calls = snapHelperSpy.mock.calls[0][0];

      const lastPanel = calls[calls.length - 1];

      expect(lastPanel).toStrictEqual({
        type: 'panel',
        children: [
          {
            type: 'row',
            label: 'Comment',
            value: { markdown: false, type: 'text', value: 'test comment' },
          },
          {
            type: 'row',
            label: 'Network fee',
            value: { markdown: false, type: 'text', value: expect.any(String) },
          },
          {
            type: 'row',
            label: 'Total',
            value: { markdown: false, type: 'text', value: expect.any(String) },
          },
        ],
      });
    });

    it('display `Recipient` as label in dialog if there is only 1 recipient', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const {
        testHelper,
        snapHelperSpy,
        // Reduce utxo value to avoid change output
      } = await prepareSendMany(caip2ChainId, 1, 1, 1, 800, 800);

      await sendMany(
        testHelper.sender,
        origin,
        createSendManyParams(
          testHelper.recipients,
          caip2ChainId,
          true,
          'test comment',
        ),
      );

      const calls = snapHelperSpy.mock.calls[0][0];

      const recipientsPanel = calls[2];

      expect(recipientsPanel).toStrictEqual({
        type: 'panel',
        children: [
          {
            type: 'row',
            label: 'Recipient',
            value: {
              type: 'text',
              value: `[${shortenAddress(
                testHelper.recipients[0].address,
              )}](${getExplorerUrl(
                testHelper.recipients[0].address,
                caip2ChainId,
              )})`,
            },
          },
          {
            type: 'row',
            label: 'Amount',
            value: { markdown: false, type: 'text', value: '0.00000500 BTC' },
          },
        ],
      });
    });

    it('display `Origin` in dialog', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const {
        testHelper,
        snapHelperSpy,
        // Reduce utxo value to avoid change output
      } = await prepareSendMany(caip2ChainId);

      await sendMany(
        testHelper.sender,
        origin,
        createSendManyParams(testHelper.recipients, caip2ChainId, true),
      );

      const calls = snapHelperSpy.mock.calls[0][0];

      const introPanel = calls[0];

      expect(introPanel).toStrictEqual({
        type: 'panel',
        children: [
          {
            type: 'heading',
            value: 'Send Request',
          },
          {
            type: 'text',
            value:
              "Review the request before proceeding. Once the transaction is made, it's irreversible.",
          },
          {
            type: 'row',
            label: 'Requested by',
            value: {
              type: 'text',
              value: origin,
              markdown: false,
            },
          },
        ],
      });
    });

    it('throws InvalidParamsError when request parameter is not correct', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId);

      await expect(
        sendMany(testHelper.sender, origin, {
          amounts: {
            'invalid-address': '1',
          },
        } as unknown as SendManyParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `Transaction must have at least one recipient` error if no recipient provided', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId, 0);

      await expect(
        sendMany(
          testHelper.sender,
          origin,
          createSendManyParams([], caip2ChainId, false),
        ),
      ).rejects.toThrow('Transaction must have at least one recipient');
    });

    it('throws `Invalid amount, must be a positive finite number` error if receive amount is not valid', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId, 2);

      await expect(
        sendMany(testHelper.sender, origin, {
          ...createSendManyParams(testHelper.recipients, caip2ChainId, false),
          amounts: {
            [testHelper.recipients[0].address]: 'invalid',
            [testHelper.recipients[1].address]: '0.1',
          },
        }),
      ).rejects.toThrow('Invalid amount, must be a positive finite number');
    });

    it('throws `Invalid amount, out of bounds` error if receive amount is out of bounds', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId, 2);

      await expect(
        sendMany(testHelper.sender, origin, {
          ...createSendManyParams(testHelper.recipients, caip2ChainId, false),
          amounts: {
            [testHelper.recipients[0].address]: '999999999.99999999',
            [testHelper.recipients[1].address]: '0.1',
          },
        }),
      ).rejects.toThrow('Invalid amount, out of bounds');
    });

    it('throws `Invalid response` error if the response is unexpected', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId);

      testHelper.broadcastTransactionSpy.mockReset().mockResolvedValue({
        transactionId: '',
      });

      await expect(
        sendMany(
          testHelper.sender,
          origin,
          createSendManyParams(testHelper.recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Invalid Response');
    });

    it('throws UserRejectedRequestError error if user denied the transaction', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper, snapHelperSpy } = await prepareSendMany(caip2ChainId);
      snapHelperSpy.mockResolvedValue(false);

      await expect(
        sendMany(
          testHelper.sender,
          origin,
          createSendManyParams(testHelper.recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow(UserRejectedRequestError);
    });

    it('throws `Failed to send the transaction` error if no fee rate is returned from the chain service', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId);

      await testHelper.createNoFeeAvailableTest();

      await expect(
        sendMany(
          testHelper.sender,
          origin,
          createSendManyParams(testHelper.recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws `Failed to send the transaction` error if the transaction is fail to commit', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId);

      testHelper.broadcastTransactionSpy
        .mockReset()
        .mockRejectedValue(new Error('error'));

      await expect(
        sendMany(
          testHelper.sender,
          origin,
          createSendManyParams(testHelper.recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws DisplayableError error message if the DisplayableError is thrown', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { testHelper } = await prepareSendMany(caip2ChainId);

      testHelper.broadcastTransactionSpy
        .mockReset()
        .mockRejectedValue(new TxValidationError('some tx error'));

      await expect(
        sendMany(
          testHelper.sender,
          origin,
          createSendManyParams(testHelper.recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('some tx error');
    });
  });
});
