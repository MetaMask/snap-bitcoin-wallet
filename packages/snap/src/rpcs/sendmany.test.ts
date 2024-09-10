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
import type { BtcAccount } from '../bitcoin/wallet';
import {
  BtcAccountDeriver,
  BtcWallet,
  type ITxInfo,
  TxValidationError,
} from '../bitcoin/wallet';
import { Config } from '../config';
import { Caip2ChainId } from '../constants';
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
            type: Config.defaultFeeRate,
            rate: BigInt(1),
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

    it('does create comment component in dialog if consumer has provide the comment', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { sender, recipients, snapHelperSpy } = await prepareSendMany(
        network,
        caip2ChainId,
      );

      await sendMany(
        sender,
        origin,
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
      const caip2ChainId = Caip2ChainId.Testnet;
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
        feeRate: BigInt('1'),
        txFee: BigInt('1'),
        sender: sender.address,
        recipients: [
          {
            address: recipients[0].address,
            value: BigInt('1000'),
          },
        ],
        total: BigInt('1000'),
      };

      walletCreateTxSpy.mockResolvedValue({
        tx: 'transaction',
        txInfo: info,
      });

      walletSignTxSpy.mockResolvedValue('txId');

      await sendMany(
        sender,
        origin,
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
              value: `[${shortenAddress(
                recipients[0].address,
              )}](${getExplorerUrl(recipients[0].address, caip2ChainId)})`,
            },
          },
          {
            type: 'row',
            label: 'Amount',
            value: { markdown: false, type: 'text', value: '0.00001000 BTC' },
          },
        ],
      });
    });

    it('display `Origin` in dialog', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
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
        feeRate: BigInt('1'),
        txFee: BigInt('1'),
        sender: sender.address,
        recipients: [
          {
            address: recipients[0].address,
            value: BigInt('1000'),
          },
        ],
        total: BigInt('1000'),
      };

      walletCreateTxSpy.mockResolvedValue({
        tx: 'transaction',
        txInfo: info,
      });

      walletSignTxSpy.mockResolvedValue('txId');

      await sendMany(
        sender,
        origin,
        createSendManyParams([recipients[0]], caip2ChainId, true),
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
      const { snapHelperSpy, sender, recipients } = await prepareSendMany(
        network,
        caip2ChainId,
      );
      snapHelperSpy.mockResolvedValue(false);

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

    it('skips the transaction confirmation dialog if the origin is `metamask`', async () => {
      const network = networks.testnet;
      const caip2ChainId = Caip2ChainId.Testnet;
      const { recipients, snapHelperSpy, sender } = await prepareSendMany(
        network,
        caip2ChainId,
      );

      await sendMany(
        sender,
        'metamask',
        createSendManyParams(recipients, caip2ChainId, true),
      );

      expect(snapHelperSpy).toHaveBeenCalledTimes(0);
    });
  });
});
