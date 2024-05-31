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
  BtcAddress,
  BtcTransactionInfo,
} from '../bitcoin/wallet';
import { FeeRatio } from '../chain';
import { Factory } from '../factory';
import { SnapHelper } from '../libs/snap';
import type { IAccount } from '../wallet';
import { SendManyHandler } from './sendmany';
import type { SendManyParams } from './sendmany';

jest.mock('../libs/logger/logger');
jest.mock('../libs/snap/helpers');

describe('SendManyHandler', () => {
  describe('handleRequest', () => {
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
      caip2Network: string,
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
          scope: caip2Network,
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
      caip2Network: string,
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
        scope: caip2Network,
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
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));
    };

    const createMockBroadcastTransactionResp = () => {
      return generateBlockChairBroadcastTransactionResp().data.transaction_hash;
    };

    const prepareSendMany = async (network, caip2Network) => {
      const {
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      } = createMockChainApiFactory();
      const snapHelperSpy = jest.spyOn(SnapHelper, 'confirmDialog');

      const { sender, keyringAccount, recipients } =
        await createSenderNRecipients(network, caip2Network, 2);

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
      const caip2Network = Network.Testnet;
      const {
        keyringAccount,
        recipients,
        broadcastResp,
        getDataForTransactionSpy,
        getFeeRatesSpy,
        broadcastTransactionSpy,
      } = await prepareSendMany(network, caip2Network);

      const result = await SendManyHandler.getInstance({
        scope: caip2Network,
        index: 0,
        account: keyringAccount,
      }).execute(createSendManyParams(recipients, caip2Network, false));

      expect(result).toStrictEqual({ txId: broadcastResp });
      expect(getFeeRatesSpy).toHaveBeenCalledTimes(1);
      expect(getDataForTransactionSpy).toHaveBeenCalledTimes(1);
      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('does not broadcast transaction if in dryrun mode', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, recipients, broadcastTransactionSpy } =
        await prepareSendMany(network, caip2Network);

      await SendManyHandler.getInstance({
        scope: caip2Network,
        index: 0,
        account: keyringAccount,
      }).execute(createSendManyParams(recipients, caip2Network, true));

      expect(broadcastTransactionSpy).toHaveBeenCalledTimes(0);
    });

    it('does create comment component in dialog if consumer has provide the comment', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, recipients, snapHelperSpy } =
        await prepareSendMany(network, caip2Network);

      await SendManyHandler.getInstance({
        scope: caip2Network,
        index: 0,
        account: keyringAccount,
      }).execute(
        createSendManyParams(recipients, caip2Network, true, 'test comment'),
      );

      const calls = snapHelperSpy.mock.calls[0][0];

      expect(calls[calls.length - 4]).toStrictEqual({
        type: 'row',
        label: 'Comment',
        value: { type: 'text', value: 'test comment' },
      });
    });

    it('display `Recipient` as label in dialog if there is only 1 receipient', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, recipients, snapHelperSpy } =
        await prepareSendMany(network, caip2Network);
      const walletCreateTxnSpy = jest.spyOn(
        BtcWallet.prototype,
        'createTransaction',
      );
      const walletSignTxnSpy = jest.spyOn(
        BtcWallet.prototype,
        'signTransaction',
      );

      const info = new BtcTransactionInfo();
      info.recipients.set(
        new BtcAddress(recipients[0].address, networks.testnet),
        new BtcAmount(100),
      );

      walletCreateTxnSpy.mockResolvedValue({
        txn: 'txn',
        txnInfo: info,
      });

      walletSignTxnSpy.mockResolvedValue('txId');

      await SendManyHandler.getInstance({
        scope: caip2Network,
        index: 0,
        account: keyringAccount,
      }).execute(createSendManyParams([recipients[0]], caip2Network, true));

      const calls = snapHelperSpy.mock.calls[0][0];

      expect(calls[3]).toHaveProperty('label', 'Recipient');
    });

    it('throws `Request params is invalid` error when request parameter is not correct', async () => {
      createMockChainApiFactory();

      await expect(
        SendManyHandler.getInstance().execute({
          scope: Network.Testnet,
        }),
      ).rejects.toThrow(InvalidParamsError);
    });

    it('throws `Account not found` error when given address not match', async () => {
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, recipients } = await createSenderNRecipients(
        network,
        caip2Network,
        2,
      );
      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 20,
          account: keyringAccount,
        }).execute(createSendManyParams(recipients, caip2Network, false)),
      ).rejects.toThrow('Account not found');
    });

    it('throws `Transaction must have at least one recipient` error if no recipient provided', async () => {
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, recipients } = await createSenderNRecipients(
        network,
        caip2Network,
        0,
      );
      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(recipients, caip2Network, false)),
      ).rejects.toThrow('Transaction must have at least one recipient');
    });

    it('throws `Failed to send the transaction` error if no fee rate returns from chain service', async () => {
      const { getFeeRatesSpy } = createMockChainApiFactory();
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, recipients } = await createSenderNRecipients(
        network,
        caip2Network,
        10,
      );
      getFeeRatesSpy.mockResolvedValue({
        fees: [],
      });

      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(recipients, caip2Network, false)),
      ).rejects.toThrow('Failed to send the transaction');
    });

    it('throws `Invalid amount for send` error if sending amount is <= 0', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      createMockChainApiFactory();
      const { keyringAccount, recipients } = await createSenderNRecipients(
        network,
        caip2Network,
        2,
      );

      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute({
          ...createSendManyParams(recipients, caip2Network, false),
          amounts: {
            [recipients[0].address]: satsToBtc(500),
            [recipients[1].address]: satsToBtc(0),
          },
        }),
      ).rejects.toThrow('Invalid amount for send');
    });

    it('throws `Invalid response` error if the response is unexpected', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, recipients, broadcastTransactionSpy } =
        await prepareSendMany(network, caip2Network);

      broadcastTransactionSpy.mockResolvedValue({
        transactionId: {
          txId: 'invalid',
        },
      });
      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(recipients, caip2Network, false)),
      ).rejects.toThrow('Invalid Response');
    });

    it('throws UserRejectedRequestError error if user denied the transaction', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { snapHelperSpy, keyringAccount, recipients } =
        await prepareSendMany(network, caip2Network);
      snapHelperSpy.mockResolvedValue(false);

      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(recipients, caip2Network, false)),
      ).rejects.toThrow(UserRejectedRequestError);
    });

    it('throws `Failed to send the transaction` error if the transaction is fail to commit', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { broadcastTransactionSpy, keyringAccount, recipients } =
        await prepareSendMany(network, caip2Network);
      broadcastTransactionSpy.mockRejectedValue(new Error('error'));

      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(recipients, caip2Network, false)),
      ).rejects.toThrow('Failed to send the transaction');
    });
  });
});
