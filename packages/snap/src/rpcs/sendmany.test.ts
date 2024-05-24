import ecc from '@bitcoinerlab/secp256k1';
import type { SLIP10NodeInterface } from '@metamask/key-tree';
import { BIP32Factory } from 'bip32';
import { networks } from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import { v4 as uuidv4 } from 'uuid';

import {
  generateBlockChairBroadcastTransactionResp,
  generateBlockChairGetUtxosResp,
} from '../../test/utils';
import { FeeRatio } from '../chain';
import { Factory } from '../factory';
import { DustLimit, Network, ScriptType } from '../modules/bitcoin/constants';
import { satsToBtc } from '../modules/bitcoin/utils/unit';
import type { IBtcAccount } from '../modules/bitcoin/wallet';
import { BtcAccountBip32Deriver, BtcWallet } from '../modules/bitcoin/wallet';
import { SnapHelper } from '../modules/snap';
import type { IAccount } from '../wallet';
import { SendManyHandler } from './sendmany';
import type { SendManyParams } from './sendmany';

jest.mock('../modules/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SendManyHandler', () => {
  describe('handleRequest', () => {
    const createMockChainApiFactory = () => {
      const getDataForTransactionSpy = jest.fn();
      const estimatedFeeSpy = jest.fn();
      const boardcastTransactionSpy = jest.fn();

      jest.spyOn(Factory, 'createOnChainServiceProvider').mockReturnValue({
        estimateFees: estimatedFeeSpy,
        getBalances: jest.fn(),
        boardcastTransaction: boardcastTransactionSpy,
        listTransactions: jest.fn(),
        getTransaction: jest.fn(),
        getDataForTransaction: getDataForTransactionSpy,
      });
      return {
        getDataForTransactionSpy,
        estimatedFeeSpy,
        boardcastTransactionSpy,
      };
    };

    const createMockBip32Instance = (network) => {
      const ECPair = ECPairFactory(ecc);
      const bip32 = BIP32Factory(ecc);

      const keyPair = ECPair.makeRandom();
      const deriver = bip32.fromSeed(keyPair.publicKey, network);

      const jsonData = {
        privateKey: deriver.privateKey?.toString('hex'),
        publicKey: deriver.publicKey.toString('hex'),
        chainCode: deriver.chainCode.toString('hex'),
        depth: deriver.depth,
        index: deriver.index,
        curve: 'secp256k1',
        masterFingerprint: undefined,
        parentFingerprint: 0,
      };
      jest.spyOn(SnapHelper, 'getBip32Deriver').mockResolvedValue({
        ...jsonData,
        chainCodeBytes: deriver.chainCode,
        privateKeyBytes: deriver.privateKey,
        publicKeyBytes: deriver.publicKey,
        toJSON: jest.fn().mockReturnValue(jsonData),
      } as unknown as SLIP10NodeInterface);

      const rootSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getRoot');
      const childSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getChild');

      return {
        instance: new BtcAccountBip32Deriver(network),
        rootSpy,
        childSpy,
      };
    };

    const createSenderNReceipents = async (
      network,
      caip2Network: string,
      receipentCnt: number,
    ) => {
      const { instance } = createMockBip32Instance(network);
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
      const receipents: IAccount[] = [];
      for (let i = 1; i < receipentCnt + 1; i++) {
        receipents.push(await wallet.unlock(i, ScriptType.P2wpkh));
      }

      return {
        sender,
        keyringAccount,
        receipents,
      };
    };

    const createSendManyParams = (
      receipents: IAccount[],
      caip2Network: string,
      dryrun: boolean,
    ): SendManyParams => {
      return {
        amounts: receipents.reduce((acc, receipent: IBtcAccount) => {
          acc[receipent.address] = satsToBtc(
            DustLimit[receipent.scriptType] + 1,
          );
          return acc;
        }, {}),
        comment: '',
        subtractFeeFrom: [],
        replaceable: false,
        dryrun,
        scope: caip2Network,
      } as unknown as SendManyParams;
    };

    it('returns correct result', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const {
        getDataForTransactionSpy,
        estimatedFeeSpy,
        boardcastTransactionSpy,
      } = createMockChainApiFactory();
      const { sender, keyringAccount, receipents } =
        await createSenderNReceipents(network, caip2Network, 2);
      const mockResponse = generateBlockChairGetUtxosResp(sender.address, 10);
      const utxos = mockResponse.data[sender.address].utxo.map((utxo) => ({
        block: utxo.block_id,
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));
      const boardcastResp =
        generateBlockChairBroadcastTransactionResp().data.transaction_hash;
      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos,
        },
      });
      estimatedFeeSpy.mockResolvedValue({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: 1,
          },
        ],
      });
      boardcastTransactionSpy.mockResolvedValue({
        txnHash: boardcastResp,
      });
      jest.spyOn(SnapHelper, 'confirmDialog').mockResolvedValue(true);

      const result = await SendManyHandler.getInstance({
        scope: caip2Network,
        index: 0,
        account: keyringAccount,
      }).execute(createSendManyParams(receipents, caip2Network, false));

      expect(result).toStrictEqual({ txnHash: boardcastResp });
      expect(estimatedFeeSpy).toHaveBeenCalledTimes(1);
      expect(getDataForTransactionSpy).toHaveBeenCalledTimes(1);
      expect(boardcastTransactionSpy).toHaveBeenCalledTimes(1);
    });

    it('does not boardcast transaction if in dryrun mode', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const {
        getDataForTransactionSpy,
        estimatedFeeSpy,
        boardcastTransactionSpy,
      } = createMockChainApiFactory();
      const { sender, keyringAccount, receipents } =
        await createSenderNReceipents(network, caip2Network, 2);
      const mockResponse = generateBlockChairGetUtxosResp(sender.address, 10);
      const utxos = mockResponse.data[sender.address].utxo.map((utxo) => ({
        block: utxo.block_id,
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));
      const boardcastResp =
        generateBlockChairBroadcastTransactionResp().data.transaction_hash;
      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos,
        },
      });
      estimatedFeeSpy.mockResolvedValue({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: 1,
          },
        ],
      });
      boardcastTransactionSpy.mockResolvedValue({
        txnHash: boardcastResp,
      });
      jest.spyOn(SnapHelper, 'confirmDialog').mockResolvedValue(true);

      await SendManyHandler.getInstance({
        scope: caip2Network,
        index: 0,
        account: keyringAccount,
      }).execute(createSendManyParams(receipents, caip2Network, true));

      expect(boardcastTransactionSpy).toHaveBeenCalledTimes(0);
    });

    it('throws `Request params is invalid` error when request parameter is not correct', async () => {
      createMockChainApiFactory();

      await expect(
        SendManyHandler.getInstance().execute({
          scope: Network.Testnet,
        }),
      ).rejects.toThrow('Request params is invalid');
    });

    it('throws `Account not found` error when given address not match', async () => {
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, receipents } = await createSenderNReceipents(
        network,
        caip2Network,
        2,
      );
      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 20,
          account: keyringAccount,
        }).execute(createSendManyParams(receipents, caip2Network, false)),
      ).rejects.toThrow('Account not found');
    });

    it('throws `Transaction must have at least one recipient` error if no recipient provided', async () => {
      createMockChainApiFactory();
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const { keyringAccount, receipents } = await createSenderNReceipents(
        network,
        caip2Network,
        0,
      );
      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(receipents, caip2Network, false)),
      ).rejects.toThrow('Transaction must have at least one recipient');
    });

    it('throws `Invalid amount for send` error if sending amount is <= 0', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      createMockChainApiFactory();
      const { keyringAccount, receipents } = await createSenderNReceipents(
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
          ...createSendManyParams(receipents, caip2Network, false),
          amounts: {
            [receipents[0].address]: satsToBtc(500),
            [receipents[1].address]: satsToBtc(0),
          },
        }),
      ).rejects.toThrow('Invalid amount for send');
    });

    it('throws `User denied transaction request` error if user denied the transaction', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const {
        getDataForTransactionSpy,
        estimatedFeeSpy,
        boardcastTransactionSpy,
      } = createMockChainApiFactory();
      const { sender, keyringAccount, receipents } =
        await createSenderNReceipents(network, caip2Network, 2);
      const mockResponse = generateBlockChairGetUtxosResp(sender.address, 10);
      const utxos = mockResponse.data[sender.address].utxo.map((utxo) => ({
        block: utxo.block_id,
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));
      const boardcastResp =
        generateBlockChairBroadcastTransactionResp().data.transaction_hash;
      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos,
        },
      });
      estimatedFeeSpy.mockResolvedValue({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: 1,
          },
        ],
      });
      boardcastTransactionSpy.mockResolvedValue({
        txnHash: boardcastResp,
      });
      jest.spyOn(SnapHelper, 'confirmDialog').mockResolvedValue(false);

      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(receipents, caip2Network, false)),
      ).rejects.toThrow('User denied transaction request');
    });

    it('throws `Failed to commit transaction on chain` error if the transaction is fail to commit', async () => {
      const network = networks.testnet;
      const caip2Network = Network.Testnet;
      const {
        getDataForTransactionSpy,
        estimatedFeeSpy,
        boardcastTransactionSpy,
      } = createMockChainApiFactory();
      const { sender, keyringAccount, receipents } =
        await createSenderNReceipents(network, caip2Network, 2);
      const mockResponse = generateBlockChairGetUtxosResp(sender.address, 10);
      const utxos = mockResponse.data[sender.address].utxo.map((utxo) => ({
        block: utxo.block_id,
        txnHash: utxo.transaction_hash,
        index: utxo.index,
        value: utxo.value,
      }));
      getDataForTransactionSpy.mockResolvedValue({
        data: {
          utxos,
        },
      });
      estimatedFeeSpy.mockResolvedValue({
        fees: [
          {
            type: FeeRatio.Fast,
            rate: 1,
          },
        ],
      });
      boardcastTransactionSpy.mockRejectedValue(new Error('error'));
      jest.spyOn(SnapHelper, 'confirmDialog').mockResolvedValue(true);

      await expect(
        SendManyHandler.getInstance({
          scope: caip2Network,
          index: 0,
          account: keyringAccount,
        }).execute(createSendManyParams(receipents, caip2Network, false)),
      ).rejects.toThrow('Failed to commit transaction on chain');
    });
  });
});
