import ecc from '@bitcoinerlab/secp256k1';
import type { SLIP10NodeInterface } from '@metamask/key-tree';
import { BIP32Factory } from 'bip32';
import { networks } from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';

import { generateFormatedUtxos } from '../../../../test/utils';
import { SnapHelper } from '../../snap';
import { DustLimit, ScriptType } from '../constants';
import { P2SHP2WPKHAccount, P2WPKHAccount } from './account';
import { CoinSelectService } from './coin-select';
import { BtcAccountBip32Deriver } from './deriver';
import { WalletError } from './exceptions';
import { PsbtService } from './psbt';
import { BtcWallet } from './wallet';

describe('BtcWallet', () => {
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

  const createMockWallet = (network) => {
    const {
      instance: deriver,
      rootSpy,
      childSpy,
    } = createMockBip32Instance(network);

    const instance = new BtcWallet(deriver, network);
    return {
      instance,
      rootSpy,
      childSpy,
    };
  };

  const createMockTxnIndent = (address: string, amount: number) => {
    return {
      amounts: {
        [address]: amount,
      },
      subtractFeeFrom: [],
      replaceable: false,
    };
  };

  describe('unlock', () => {
    it('returns an `Account` objec with type bip122:p2wpkh', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance } = createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, `bip122:p2wpkh`);

      expect(result).toBeInstanceOf(P2WPKHAccount);
      expect(rootSpy).toHaveBeenCalledWith(P2WPKHAccount.path);
      expect(childSpy).toHaveBeenCalledWith(expect.any(Object), idx);
    });

    it('returns an `Account` objec with type `p2wpkh`', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance } = createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, ScriptType.P2wpkh);

      expect(result).toBeInstanceOf(P2WPKHAccount);
      expect(rootSpy).toHaveBeenCalledWith(P2WPKHAccount.path);
      expect(childSpy).toHaveBeenCalledWith(expect.any(Object), idx);
    });

    it('returns an `Account` object with type `p2shp2wkh`', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance } = createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, ScriptType.P2shP2wkh);

      expect(result).toBeInstanceOf(P2SHP2WPKHAccount);
      expect(rootSpy).toHaveBeenCalledWith(P2SHP2WPKHAccount.path);
      expect(childSpy).toHaveBeenCalledWith(expect.any(Object), idx);
    });

    it('throws error if the account cannot be unlocked', async () => {
      const network = networks.testnet;
      const idx = 0;
      const { instance } = createMockWallet(network);

      await expect(instance.unlock(idx, ScriptType.P2pkh)).rejects.toThrow(
        WalletError,
      );
    });
  });

  describe('createTransaction', () => {
    it('creates an transaction', async () => {
      const network = networks.testnet;
      const { instance } = createMockBip32Instance(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2);

      const result = await wallet.createTransaction(
        account,
        createMockTxnIndent(account.address, DustLimit[account.scriptType] + 1),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      expect(result).toStrictEqual({
        txn: expect.any(String),
        txnJson: {
          feeRate: 1,
          estimatedFee: expect.any(Number),
          sender: account.address,
          recipients: expect.any(Array),
          changes: expect.any(Array),
        },
      });
    });

    it('passes correct parameter to CoinSelectService', async () => {
      const network = networks.testnet;
      const { instance } = createMockBip32Instance(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2);
      const coinSelectServiceSpy = jest.spyOn(
        CoinSelectService.prototype,
        'selectCoins',
      );

      await wallet.createTransaction(
        account,
        createMockTxnIndent(account.address, DustLimit[account.scriptType] + 1),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      expect(coinSelectServiceSpy).toHaveBeenCalledWith(
        utxos,
        [
          {
            address: account.address,
            value: DustLimit[account.scriptType] + 1,
          },
        ],
        account.payment.output,
      );
    });

    it('remove dist change', async () => {
      const network = networks.testnet;
      const { instance } = createMockBip32Instance(network);
      const wallet = new BtcWallet(instance, network);
      const chgAccount = await wallet.unlock(0, ScriptType.P2wpkh);
      const recipient = await wallet.unlock(1, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(recipient.address, 2);
      const coinSelectServiceSpy = jest.spyOn(
        CoinSelectService.prototype,
        'selectCoins',
      );
      const psbtServiceSpy = jest
        .spyOn(PsbtService.prototype, 'addOutputs')
        .mockReturnThis();

      // to avoid modifiy the original object when we needed to test the output
      psbtServiceSpy.mockReturnThis();
      coinSelectServiceSpy.mockReturnValue({
        inputs: utxos,
        outputs: [
          {
            address: recipient.address,
            value: 500,
          },
          {
            value: DustLimit[chgAccount.scriptType] - 1,
          },
        ],
        fee: 100,
      });

      await wallet.createTransaction(
        chgAccount,
        createMockTxnIndent(recipient.address, 500),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      expect(psbtServiceSpy).toHaveBeenCalledWith([
        {
          address: recipient.address,
          value: 500,
        },
      ]);
    });

    it('throws `Unable to get account script hash` error if the account script hash is undefined', async () => {
      const network = networks.testnet;
      const { instance } = createMockBip32Instance(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2);
      account.payment.output = undefined;

      await expect(
        wallet.createTransaction(
          account,
          createMockTxnIndent(
            account.address,
            DustLimit[account.scriptType] + 1,
          ),
          {
            utxos,
            fee: 1,
            subtractFeeFrom: [],
            replaceable: false,
          },
        ),
      ).rejects.toThrow('Unable to get account script hash');
    });
  });

  describe('signTransaction', () => {
    it('signs an transaction', async () => {
      const network = networks.testnet;
      const { instance } = createMockBip32Instance(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2);

      const { txn } = await wallet.createTransaction(
        account,
        createMockTxnIndent(account.address, DustLimit[account.scriptType] + 1),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      const sign = await wallet.signTransaction(account.signer, txn);

      expect(sign).not.toBeNull();
      expect(sign).not.toBe('');
    });
  });
});
