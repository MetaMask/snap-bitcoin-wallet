import {
  InvalidParamsError,
  UserRejectedRequestError,
} from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import { v4 as uuidV4 } from 'uuid';

import {
  generateBlockChairBroadcastTransactionResp,
  generateBlockChairGetUtxosResp,
} from '../../test/utils';
import { BtcOnChainService } from '../bitcoin/chain';
import type { BtcAccount, Recipient } from '../bitcoin/wallet';
import {
  BtcAccountDeriver,
  BtcWallet,
  type ITxInfo,
  TxValidationError,
  InsufficientFundsError,
} from '../bitcoin/wallet';
import { Config } from '../config';
import { Caip2ChainId } from '../constants';
import { metamask } from '../permissions';
import { getExplorerUrl, shortenAddress, satsToBtc } from '../utils';
import * as snapUtils from '../utils/snap';
import { type SendManyParams, sendMany } from './sendmany';

jest.mock('../utils/logger');
jest.mock('../utils/snap');

describe('SendManyHandler', () => {
  describe('sendMany', () => {
    const origin = 'http://localhost:3000';

    const createMockChainApiFactory = () => {
      const getFeeRatesSpy = jest.spyOn(
        BtcOnChainService.prototype,
        'getFeeRates',
      );
      const broadcastTransactionSpy = jest.spyOn(
        BtcOnChainService.prototype,
        'broadcastTransaction',
      );
      const getDataForTransactionSpy = jest.spyOn(
        BtcOnChainService.prototype,
        'getDataForTransaction',
      );

      return {
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      };
    };

    const createMockDeriver = (network) => {
      return {
        instance: new BtcAccountDeriver(network),
      };
    };

    const createSenderNRecipients = async (
      network,
      caip2ChainId: string,
      recipientCnt: number,
    ) => {
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const sender = await wallet.unlock(0, Config.wallet.defaultAccountType);

      const keyringAccount = {
        type: sender.type,
        id: uuidV4(),
        address: sender.address,
        options: {
          scope: caip2ChainId,
          index: sender.index,
        },
        methods: ['btc_sendmany'],
      };
      const recipients: BtcAccount[] = [];
      for (let i = 1; i < recipientCnt + 1; i++) {
        recipients.push(
          await wallet.unlock(i, Config.wallet.defaultAccountType),
        );
      }

      return {
        sender,
        keyringAccount,
        recipients,
      };
    };

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
      return mockResponse.data[address].utxo.map((utxo) => ({
        block: utxo.block_id,
        txHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));
    };

    const createMockBroadcastTransactionResp = () => {
      return generateBlockChairBroadcastTransactionResp().data.transaction_hash;
    };

    const prepareSendMany = async (network, caip2ChainId) => {
      const {
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      } = createMockChainApiFactory();
      const confirmDialogSpy = jest.spyOn(snapUtils, 'confirmDialog');

      const { sender, keyringAccount, recipients } =
        await createSenderNRecipients(network, caip2ChainId, 2);

      const broadcastResp = createMockBroadcastTransactionResp();

      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos: createMockGetDataForTransactionResp(sender.address, 10),
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
      broadcastTransactionSpy.mockResolvedValue({
        transactionId: broadcastResp,
      });
      confirmDialogSpy.mockResolvedValue(true);

      return {
        sender,
        keyringAccount,
        recipients,
        broadcastResp,
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
        confirmDialogSpy,
      };
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
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const {
        sender,
        recipients,
        broadcastResp,
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      } = await prepareSendMany(network, caip2ChainId);

      const result = await sendMany(
        sender,
        origin,
        createSendManyParams(recipients, caip2ChainId, false),
      );

      expect(result).toStrictEqual({ txId: broadcastResp });
      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(getDataForTransactionSpy).toHaveBeenCalledTimes(1);
      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast transaction if in dryrun mode', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, sender, broadcastTransactionSpy } =
        await prepareSendMany(network, caip2ChainId);

      await sendMany(
        sender,
        origin,
        createSendManyParams(recipients, caip2ChainId, true),
      );

      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(0);
    });

    it('displays a transaction confirmation dialog if the bitcoin transaction has been created successfully', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, confirmDialogSpy, sender } = await prepareSendMany(
        network,
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
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, confirmDialogSpy } = await prepareSendMany(
        network,
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

    it('does not displays a transaction confirmation dialog if the configuration `showConfirmation` is set to `false`', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, confirmDialogSpy, sender } = await prepareSendMany(
        network,
        caip2ChainId,
      );

      await sendMany(
        sender,
        metamask,
        createSendManyParams(recipients, caip2ChainId, true),
        {
          showConfirmation: false,
          showWarning: false,
        },
      );

      expect(confirmDialogSpy).toHaveBeenCalledTimes(0);
    });

    it('displays a warning dialog if the account has insufficient funds to pay the transaction', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const {
        recipients: [recipient],
        sender,
        getDataForTransactionSpy,
      } = await prepareSendMany(network, caip2ChainId);

      const alertDialogSpy = jest.spyOn(snapUtils, 'alertDialog');
      alertDialogSpy.mockReturnThis();

      // force account to have insufficient funds
      getDataForTransactionSpy.mockReset().mockResolvedValue({
        data: {
          utxos: [],
        },
      });
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

    it('does not display a warning dialog if the configuration `showWarning` is set to `false`', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const {
        recipients: [recipient],
        sender,
        getDataForTransactionSpy,
      } = await prepareSendMany(network, caip2ChainId);

      const alertDialogSpy = jest.spyOn(snapUtils, 'alertDialog');

      // force account to have insufficient funds
      getDataForTransactionSpy.mockReset().mockResolvedValue({
        data: {
          utxos: [],
        },
      });

      await expect(
        sendMany(
          sender,
          metamask,
          createSendManyParams([recipient], caip2ChainId, true),
          {
            showConfirmation: false,
            showWarning: false,
          },
        ),
      ).rejects.toThrow(InsufficientFundsError);
      expect(alertDialogSpy).toHaveBeenCalledTimes(0);
    });

    it('throws InvalidParamsError when request parameter is not correct', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender } = await prepareSendMany(network, caip2ChainId);

      await expect(
        sendMany(sender, origin, {
          amounts: {
            'some-address': '1',
          },
        } as unknown as SendManyParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `Transaction must have at least one recipient` error if no recipient provided', async () => {
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, sender } = await createSenderNRecipients(
        network,
        caip2ChainId,
        0,
      );
      await expect(
        sendMany(
          sender,
          origin,
          createSendManyParams(recipients, caip2ChainId, false),
        ),
      ).rejects.toThrow('Transaction must have at least one recipient');
    });

    it('throws `Invalid amount, must be a positive finite number` error if receive amount is not valid', async () => {
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, sender } = await createSenderNRecipients(
        network,
        caip2ChainId,
        2,
      );
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
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, sender } = await createSenderNRecipients(
        network,
        caip2ChainId,
        2,
      );

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
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, broadcastTransactionSpy } =
        await prepareSendMany(network, caip2ChainId);

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
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { confirmDialogSpy, sender, recipients } = await prepareSendMany(
        network,
        caip2ChainId,
      );
      confirmDialogSpy.mockResolvedValue(false);

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow(UserRejectedRequestError);
    });

    it('throws `Failed to send the transaction` error if no fee rate is returned from the chain service', async () => {
      const { getFeeRatesSpy } = createMockChainApiFactory();
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients } = await createSenderNRecipients(
        network,
        caip2ChainId,
        10,
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
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { broadcastTransactionSpy, sender, recipients } =
        await prepareSendMany(network, caip2ChainId);
      broadcastTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        sendMany(sender, origin, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws DisplayableError error message if the DisplayableError is thrown', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { broadcastTransactionSpy, sender, recipients } =
        await prepareSendMany(network, caip2ChainId);
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
