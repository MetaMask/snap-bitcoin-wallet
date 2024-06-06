import type { Json } from '@metamask/snaps-sdk';
import {
  InvalidParamsError,
  UserRejectedRequestError,
} from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';
import { v4 as uuidv4 } from 'uuid';

import {
  generateBlockChairBroadcastTransactionResp,
  generateBlockChairGetUtxosResp,
} from '../../test/utils';
import { DustLimit, Network, ScriptType } from '../bitcoin/constants';
import { satsToBtc } from '../bitcoin/utils/unit';
import type { IBtcAccount } from '../bitcoin/wallet';
import {
  BtcAccountBip32Deriver,
  BtcWallet,
  BtcAmount,
} from '../bitcoin/wallet';
import { FeeRatio } from '../chain';
import { Factory } from '../factory';
import * as snapUtils from '../utils/snap';
import type { IAccount, ITxInfo } from '../wallet';
import { type SendManyParams, sendMany } from './sendmany';

jest.mock('../logger');
jest.mock('../utils/snap');

describe('SendManyHandler', () => {
  describe('sendMany', () => {
    const createMockChainApiFactory = () => {
      const getDataForTransactionSpy = jest.fn();
      const getFeeRatesSpy = jest.fn();
      const broadcastTransactionSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        getFeeRates: getFeeRatesSpy,
        getBalances: jest.fn(),
        broadcastTransaction: broadcastTransactionSpy,
        listTransactions: jest.fn(),
        getTransactionStatus: jest.fn(),
        getDataForTransaction: getDataForTransactionSpy,
      });
      return {
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      };
    };

    const createMockDeriver = (network) => {
      return {
        instance: new BtcAccountBip32Deriver(network),
      };
    };

    const createSenderNRecipients = async (
      network,
      caip2ChainId: string,
      recipientCnt: number,
    ) => {
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
      const recipients: IAccount[] = [];
      for (let i = 1; i < recipientCnt + 1; i++) {
        recipients.push(await wallet.unlock(i, ScriptType.P2wpkh));
      }

      return {
        sender,
        keyringAccount,
        recipients,
      };
    };

    const createSendManyParams = (
      recipients: IAccount[],
      caip2ChainId: string,
      dryrun: boolean,
      comment = '',
    ): SendManyParams => {
      return {
        amounts: recipients.reduce((acc, recipient: IBtcAccount) => {
          acc[recipient.address] = satsToBtc(
            DustLimit[recipient.scriptType] + 1,
          );
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
      const snapHelperSpy = jest.spyOn(snapUtils, 'confirmDialog');

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
            type: FeeRatio.Fast,
            rate: new BtcAmount(1),
          },
        ],
      });
      broadcastTransactionSpy.mockResolvedValue({
        transactionId: broadcastResp,
      });
      snapHelperSpy.mockResolvedValue(true);

      return {
        sender,
        keyringAccount,
        recipients,
        broadcastResp,
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
        snapHelperSpy,
      };
    };

    it('returns correct result', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
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
        createSendManyParams(recipients, caip2ChainId, false),
      );

      expect(result).toStrictEqual({ txId: broadcastResp });
      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(getDataForTransactionSpy).toHaveBeenCalledTimes(1);
      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast transaction if in dryrun mode', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { recipients, sender, broadcastTransactionSpy } =
        await prepareSendMany(network, caip2ChainId);

      await sendMany(
        sender,
        createSendManyParams(recipients, caip2ChainId, true),
      );

      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(0);
    });

    it('does create comment component in dialog if consumer has provide the comment', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { sender, recipients, snapHelperSpy } = await prepareSendMany(
        network,
        caip2ChainId,
      );

      await sendMany(
        sender,
        createSendManyParams(recipients, caip2ChainId, true, 'test comment'),
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
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { recipients, snapHelperSpy, sender } = await prepareSendMany(
        network,
        caip2ChainId,
      );
      const walletCreateTxSpy = jest.spyOn(
        BtcWallet.prototype,
        'createTransaction',
      );
      const walletSignTxSpy = jest.spyOn(
        BtcWallet.prototype,
        'signTransaction',
      );

      const info: ITxInfo = {
        toJson<TxInfoJson extends Record<string, Json>>() {
          return {
            feeRate: `0.00000001 BTC`,
            txFee: `0.00000001 BTC`,
            sender: sender.address,
            recipients: [
              {
                address: recipients[0].address,
                value: `0.000010 BTC`,
                explorerUrl: `https://blockchair.com/bitcoin/transaction/transactionId`,
              },
            ],
            changes: [],
            total: `0.000010 BTC`,
          } as unknown as TxInfoJson;
        },
      };

      walletCreateTxSpy.mockResolvedValue({
        tx: 'transaction',
        txInfo: info,
      });

      walletSignTxSpy.mockResolvedValue('txId');

      await sendMany(
        sender,
        createSendManyParams([recipients[0]], caip2ChainId, true),
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
              value: `[${recipients[0].address}](https://blockchair.com/bitcoin/transaction/transactionId)`,
            },
          },
          {
            type: 'row',
            label: 'Amount',
            value: { markdown: false, type: 'text', value: '0.000010 BTC' },
          },
        ],
      });
    });

    it('throws `Request params is invalid` error when request parameter is not correct', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { sender } = await prepareSendMany(network, caip2ChainId);

      await expect(
        sendMany(sender, {
          amounts: {
            'some-address': '1',
          },
        } as unknown as SendManyParams),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `Transaction must have at least one recipient` error if no recipient provided', async () => {
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { recipients, sender } = await createSenderNRecipients(
        network,
        caip2ChainId,
        0,
      );
      await expect(
        sendMany(sender, createSendManyParams(recipients, caip2ChainId, false)),
      ).rejects.toThrow('Transaction must have at least one recipient');
    });

    it('throws `Failed to send the transaction` error if no fee rate returns from chain service', async () => {
      const { getFeeRatesSpy } = createMockChainApiFactory();
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { sender, recipients } = await createSenderNRecipients(
        network,
        caip2ChainId,
        10,
      );
      getFeeRatesSpy.mockResolvedValue({
        fees: [],
      });

      await expect(
        sendMany(sender, createSendManyParams(recipients, caip2ChainId, false)),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws `Invalid amount for send` error if sending amount is <= 0', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      createMockChainApiFactory();
      const { sender, recipients } = await createSenderNRecipients(
        network,
        caip2ChainId,
        2,
      );

      await expect(
        sendMany(sender, {
          ...createSendManyParams(recipients, caip2ChainId, false),
          amounts: {
            [recipients[0].address]: satsToBtc(0),
            [recipients[1].address]: satsToBtc(0),
          },
        }),
      ).rejects.toThrow('Invalid amount for send');
    });

    it('throws `Invalid response` error if the response is unexpected', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { sender, recipients, broadcastTransactionSpy } =
        await prepareSendMany(network, caip2ChainId);

      broadcastTransactionSpy.mockResolvedValue({
        transactionId: {
          txId: 'invalid',
        },
      });
      await expect(
        sendMany(sender, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('Invalid Response');
    });

    it('throws UserRejectedRequestError error if user denied the transaction', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { snapHelperSpy, sender, recipients } = await prepareSendMany(
        network,
        caip2ChainId,
      );
      snapHelperSpy.mockResolvedValue(false);

      await expect(
        sendMany(sender, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow(UserRejectedRequestError);
    });

    it('throws `Failed to send the transaction` error if the transaction is fail to commit', async () => {
      const network = networks.testnet;
      const caip2ChainId = Network.Testnet;
      const { broadcastTransactionSpy, sender, recipients } =
        await prepareSendMany(network, caip2ChainId);
      broadcastTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        sendMany(sender, {
          ...createSendManyParams(recipients, caip2ChainId, false),
        }),
      ).rejects.toThrow('Failed to send the transaction');
    });
  });
});
