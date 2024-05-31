import { networks } from 'bitcoinjs-lib';

import { generateFormatedUtxos } from '../../../test/utils';
import { DustLimit, ScriptType } from '../constants';
import { P2SHP2WPKHAccount, P2WPKHAccount } from './account';
import { CoinSelectService } from './coin-select';
import { BtcAccountBip32Deriver } from './deriver';
import { WalletError } from './exceptions';
import { PsbtService } from './psbt';
import { BtcTransactionInfo } from './transactionInfo';
import { BtcWallet } from './wallet';

jest.mock('../../libs/snap/helpers');
jest.mock('../../libs/logger/logger');

describe('BtcWallet', () => {
  const createMockDeriver = (network) => {
    const rootSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getRoot');
    const childSpy = jest.spyOn(BtcAccountBip32Deriver.prototype, 'getChild');

    return {
      instance: new BtcAccountBip32Deriver(network),
      rootSpy,
      childSpy,
    };
  };

  const createMockWallet = (network) => {
    const { instance: deriver, rootSpy, childSpy } = createMockDeriver(network);

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
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2, 10000, 10000);

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

      const info: BtcTransactionInfo =
        result.txnInfo as unknown as BtcTransactionInfo;

      expect(result).toStrictEqual({
        txn: expect.any(String),
        txnInfo: expect.any(BtcTransactionInfo),
      });

      expect(info.sender?.address).toStrictEqual(account.address);
      expect(info.feeRate?.value).toBe(1);
      expect(info.recipients?.size).toBe(1);
      expect(info.changes?.size).toBe(1);
    });

    it('passes correct parameter to CoinSelectService', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
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
      const { instance } = createMockDeriver(network);
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

      const result = await wallet.createTransaction(
        chgAccount,
        createMockTxnIndent(recipient.address, 500),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      const info: BtcTransactionInfo =
        result.txnInfo as unknown as BtcTransactionInfo;

      expect(psbtServiceSpy).toHaveBeenCalledWith([
        {
          address: recipient.address,
          value: 500,
        },
      ]);

      expect(info.txnFee.value).toStrictEqual(
        100 + DustLimit[chgAccount.scriptType] - 1,
      );
    });

    it('throws `Transaction amount too small` error the transaction output is too small', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2, 8000, 8000);

      await expect(
        wallet.createTransaction(
          account,
          createMockTxnIndent(account.address, 1),
          {
            utxos,
            fee: 20,
            subtractFeeFrom: [],
            replaceable: false,
          },
        ),
      ).rejects.toThrow('Transaction amount too small');
    });

    it('throws `Fail to get account script hash` error if the account script hash is undefined', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
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
      ).rejects.toThrow('Fail to get account script hash');
    });
  });

  describe('signTransaction', () => {
    it('signs an transaction', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
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
