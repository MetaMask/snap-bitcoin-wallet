import {
  InvalidParamsError,
  UserRejectedRequestError,
} from '@metamask/snaps-sdk';

import type { BtcAccount, Recipient } from '../bitcoin/wallet';
import {
  BtcWallet,
  type ITxInfo,
  TxValidationError,
  InsufficientFundsError,
} from '../bitcoin/wallet';
import { Caip2ChainId } from '../constants';
import { getExplorerUrl, shortenAddress, satsToBtc } from '../utils';
import { SendManyTest } from './__tests__/helper';
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
      amount = 500,
    ): SendManyParams => {
      return {
        amounts: recipients.reduce((acc, recipient) => {
          acc[recipient.address] = satsToBtc(amount);
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
      recipientCount = 10,
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
        recipientCount,
      });
      await testHelper.setup();

      return testHelper;
    };

    // this method is to create a expected response of a divider component
    const createExpectedDividerComponent = (): unknown => {
      return {
        type: 'divider',
      };
    };

    // this method is to create a expected response of a recipient list component
    const createExpectedRecipientListComponent = (
      recipients: Recipient[],
      caip2ChainId: string,
    ): unknown[] => {
      const expectedComponents: unknown[] = [];
      const recipientsLen = recipients.length;

      for (let idx = 0; idx < recipientsLen; idx++) {
        const recipient = recipients[idx];

        expectedComponents.push({
          type: 'panel',
          children: [
            {
              type: 'row',
              label: recipientsLen > 1 ? `Recipient ${idx + 1}` : `Recipient`,
              value: {
                type: 'text',
                value: `[${shortenAddress(recipient.address)}](${getExplorerUrl(
                  recipient.address,
                  caip2ChainId,
                )})`,
              },
            },
            {
              type: 'row',
              label: 'Amount',
              value: {
                markdown: false,
                type: 'text',
                value: satsToBtc(recipient.value, true),
              },
            },
          ],
        });
        expectedComponents.push(createExpectedDividerComponent());
      }
      return expectedComponents;
    };

    // this method is to create a expected response of a header panel component
    const createExpectedHeadingPanelComponent = (
      requestBy: string,
      includeReviewText = true,
    ): unknown => {
      const headingComponent = {
        type: 'heading',
        value: 'Send Request',
      };

      const reviewTextComponent = {
        type: 'text',
        value:
          "Review the request before proceeding. Once the transaction is made, it's irreversible.",
      };

      const requestByComponent = {
        type: 'row',
        label: 'Requested by',
        value: {
          type: 'text',
          value: requestBy,
          markdown: false,
        },
      };

      const panelChilds: unknown[] = [headingComponent];
      if (includeReviewText) {
        panelChilds.push(reviewTextComponent);
      }
      panelChilds.push(requestByComponent);

      return {
        type: 'panel',
        children: panelChilds,
      };
    };

    it('returns correct result', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const {
        sender,
        recipients,
        broadCastTxResp,
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      } = await prepareSendMany(caip2ChainId);

      const result = await sendMany(
        sender,
        origin,
        createSendManyParams(recipients, caip2ChainId, false),
      );

      expect(result).toStrictEqual({ txId: broadCastTxResp });
      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(getDataForTransactionSpy).toHaveBeenCalledTimes(1);
      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast transaction if in dryrun mode', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, sender, broadcastTransactionSpy } =
        await prepareSendMany(caip2ChainId);

      await sendMany(
        sender,
        origin,
        createSendManyParams(recipients, caip2ChainId, true),
      );

      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(0);
    });

    it('displays a transaction confirmation dialog if the bitcoin transaction has been created successfully', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, confirmDialogSpy, sender } = await prepareSendMany(
        caip2ChainId,
      );
      const sendAmtInSats = 500;
      const txFee = 1;
      const sendParams = createSendManyParams(
        recipients,
        caip2ChainId,
        true,
        '',
        sendAmtInSats,
      );
      const mockTxInfo: ITxInfo = {
        feeRate: BigInt(1),
        txFee: BigInt(txFee),
        sender: sender.address,
        recipients: recipients.map((recipient) => ({
          address: recipient.address,
          value: BigInt(sendAmtInSats),
        })),
        total: BigInt(sendAmtInSats * recipients.length + txFee),
      };

      // mock createTransaction and signTransaction response
      const walletCreateTxSpy = jest.spyOn(
        BtcWallet.prototype,
        'createTransaction',
      );
      const walletSignTxSpy = jest.spyOn(
        BtcWallet.prototype,
        'signTransaction',
      );
      walletCreateTxSpy.mockResolvedValue({
        tx: 'transaction',
        txInfo: mockTxInfo,
      });
      walletSignTxSpy.mockResolvedValue('txId');

      await sendMany(sender, origin, sendParams);

      expect(confirmDialogSpy).toHaveBeenCalledTimes(1);
      expect(confirmDialogSpy).toHaveBeenCalledWith([
        // heading panel
        createExpectedHeadingPanelComponent(origin),
        // divider
        createExpectedDividerComponent(),
        // recipient panel
        ...createExpectedRecipientListComponent(
          mockTxInfo.recipients,
          caip2ChainId,
        ),
        // bottom panel
        {
          type: 'panel',
          children: [
            {
              type: 'row',
              label: 'Network fee',
              value: {
                markdown: false,
                type: 'text',
                value: satsToBtc(mockTxInfo.txFee, true),
              },
            },
            {
              type: 'row',
              label: 'Total',
              value: {
                markdown: false,
                type: 'text',
                value: satsToBtc(mockTxInfo.total, true),
              },
            },
          ],
        },
      ]);
    });

    it('creates a comment component in the transaction confirmation dialog if a comment has been provided', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, confirmDialogSpy } = await prepareSendMany(
        caip2ChainId,
      );
      const comment = 'test comment';

      await sendMany(
        sender,
        origin,
        createSendManyParams(recipients, caip2ChainId, true, comment),
      );

      const calls = confirmDialogSpy.mock.calls[0][0];

      expect(calls.length).toBeGreaterThan(0);
      const lastPanel = calls[calls.length - 1];

      expect(lastPanel).toStrictEqual({
        type: 'panel',
        children: [
          {
            type: 'row',
            label: 'Comment',
            value: { markdown: false, type: 'text', value: comment },
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

    it('displays a warning dialog if the account has insufficient funds to pay the transaction', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const helper = await prepareSendMany(caip2ChainId);
      const {
        recipients: [recipient],
        sender,
        alertDialogSpy,
      } = helper;

      await helper.setupInsufficientFundsTest();

      const sendAmtInSats = 500;

      await expect(
        sendMany(
          sender,
          origin,
          createSendManyParams(
            [recipient],
            caip2ChainId,
            true,
            '',
            sendAmtInSats,
          ),
        ),
      ).rejects.toThrow(InsufficientFundsError);
      expect(alertDialogSpy).toHaveBeenCalledTimes(1);
      expect(alertDialogSpy).toHaveBeenCalledWith([
        // heading panel
        createExpectedHeadingPanelComponent(origin, false),
        // divider
        createExpectedDividerComponent(),
        // recipient panel
        ...createExpectedRecipientListComponent(
          [
            {
              address: recipient.address,
              value: BigInt(sendAmtInSats),
            },
          ],
          caip2ChainId,
        ),
        // warning message
        {
          markdown: false,
          type: 'text',
          value:
            'You do not have enough BTC in your account to pay for transaction amount or transaction fees on Bitcoin network.',
        },
      ]);
    });

    it('throws InvalidParamsError when request parameter is not correct', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender } = await prepareSendMany(caip2ChainId);

      await expect(
        sendMany(sender, origin, {
          amounts: {
            'some-address': '1',
          },
        } as unknown as SendManyParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `Transaction must have at least one recipient` error if no recipient provided', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients } = await prepareSendMany(caip2ChainId, 0);

      await expect(
        sendMany(
          sender,
          origin,
          createSendManyParams(recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Transaction must have at least one recipient');
    });

    it('throws `Invalid amount, must be a positive finite number` error if receive amount is not valid', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients } = await prepareSendMany(caip2ChainId, 2);

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
          amounts: {
            [recipients[0].address]: 'invalid',
            [recipients[1].address]: '0.1',
          },
        }),
      ).rejects.toThrow('Invalid amount, must be a positive finite number');

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
          amounts: {
            [recipients[0].address]: '0',
            [recipients[1].address]: '0.1',
          },
        }),
      ).rejects.toThrow('Invalid amount, must be a positive finite number');

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
          amounts: {
            [recipients[0].address]: 'invalid',
            [recipients[1].address]: '0.000000019',
          },
        }),
      ).rejects.toThrow('Invalid amount, must be a positive finite number');
    });

    it('throws `Invalid amount, out of bounds` error if receive amount is out of bounds', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients } = await prepareSendMany(caip2ChainId, 2);

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
          amounts: {
            [recipients[0].address]: '1',
            [recipients[1].address]: '999999999.99999999',
          },
        }),
      ).rejects.toThrow('Invalid amount, out of bounds');
    });

    it('throws `Invalid response` error if the response is unexpected', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, broadcastTransactionSpy } =
        await prepareSendMany(caip2ChainId);

      broadcastTransactionSpy.mockResolvedValue({
        transactionId: '',
      });
      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('Invalid Response');
    });

    it('throws UserRejectedRequestError error if user denied the transaction', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const helper = await prepareSendMany(caip2ChainId);
      const { sender, recipients } = helper;
      await helper.setupUserDeniedTest();

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow(UserRejectedRequestError);
    });

    it('throws `Failed to send the transaction` error if no fee rate is returned from the chain service', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, getFeeRatesSpy } = await prepareSendMany(
        caip2ChainId,
      );
      getFeeRatesSpy.mockResolvedValue({
        fees: [],
      });

      await expect(
        sendMany(
          sender,
          origin,
          createSendManyParams(recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws `Failed to send the transaction` error if the transaction is fail to commit', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { broadcastTransactionSpy, sender, recipients } =
        await prepareSendMany(caip2ChainId);
      broadcastTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws DisplayableError error message if the DisplayableError is thrown', async () => {
      const caip2ChainId = Caip2ChainId.Testnet;
      const { broadcastTransactionSpy, sender, recipients } =
        await prepareSendMany(caip2ChainId);
      broadcastTransactionSpy.mockRejectedValue(
        new TxValidationError('some tx error'),
      );

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('some tx error');
    });
  });
});
