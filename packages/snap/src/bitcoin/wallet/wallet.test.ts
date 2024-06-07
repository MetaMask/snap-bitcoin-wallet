import type { Json } from '@metamask/snaps-sdk';
import { networks } from 'bitcoinjs-lib';

import { generateFormatedUtxos } from '../../../test/utils';
import { DustLimit, ScriptType, maxSatoshi } from '../constants';
import { P2SHP2WPKHAccount, P2WPKHAccount } from './account';
import { CoinSelectService } from './coin-select';
import { BtcAccountBip32Deriver } from './deriver';
import { WalletError } from './exceptions';
import { BtcTxInfo } from './transaction-info';
import { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import type { SelectionResult } from './types';
import { BtcWallet } from './wallet';

jest.mock('../../utils/snap');
jest.mock('../../logger');

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

  const createMockTxIndent = (address: string, amount: number) => {
    return [
      {
        address,
        value: BigInt(amount),
      },
    ];
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
    it('creates an transaction with changes', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);

      const utxos = generateFormatedUtxos(
        account.address,
        200,
        maxSatoshi,
        maxSatoshi,
      );

      const result = await wallet.createTransaction(
        account,
        createMockTxIndent(account.address, maxSatoshi),
        {
          utxos,
          fee: 56,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      const json = result.txInfo.toJson();
      const recipients = json.recipients as unknown as Json[];
      const changes = json.changes as unknown as Json[];

      expect(recipients).toHaveLength(1);
      expect(changes).toHaveLength(1);
      expect(result).toStrictEqual({
        tx: expect.any(String),
        txInfo: expect.any(BtcTxInfo),
      });
    });

    it('creates an transaction without changes', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 200, 10000, 10000);

      const result = await wallet.createTransaction(
        account,
        createMockTxIndent(account.address, 100000),
        {
          utxos,
          fee: 50,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      const json = result.txInfo.toJson();
      const recipients = json.recipients as unknown as Json[];
      const changes = json.changes as unknown as Json[];

      expect(recipients).toHaveLength(1);
      expect(changes).toHaveLength(0);
      expect(result).toStrictEqual({
        tx: expect.any(String),
        txInfo: expect.any(BtcTxInfo),
      });
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
        createMockTxIndent(account.address, DustLimit[account.scriptType] + 1),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      expect(coinSelectServiceSpy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.any(TxOutput),
      );

      for (const input of coinSelectServiceSpy.mock.calls[0][0]) {
        expect(input).toBeInstanceOf(TxInput);
      }

      for (const output of coinSelectServiceSpy.mock.calls[0][1]) {
        expect(output).toBeInstanceOf(TxOutput);
      }
    });

    it('remove dist change', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const chgAccount = await wallet.unlock(0, ScriptType.P2wpkh);
      const recipient = await wallet.unlock(1, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(chgAccount.address, 2, 10000, 10000);
      const coinSelectServiceSpy = jest.spyOn(
        CoinSelectService.prototype,
        'selectCoins',
      );

      const selectionResult: SelectionResult = {
        change: new TxOutput(
          DustLimit[chgAccount.scriptType] - 1,
          chgAccount.address,
          chgAccount.script,
        ),
        fee: 100,
        inputs: utxos.map((utxo) => new TxInput(utxo, chgAccount.script)),
        outputs: [new TxOutput(500, recipient.address, recipient.script)],
      };

      coinSelectServiceSpy.mockReturnValue(selectionResult);

      const result = await wallet.createTransaction(
        chgAccount,
        createMockTxIndent(recipient.address, 500),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      const info: BtcTxInfo = result.txInfo as unknown as BtcTxInfo;

      expect(info.fee).toBe(19500);
      expect(info.change).toBeUndefined();
    });

    it('throws `Transaction amount too small` error if the transaction output is too small', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2, 8000, 8000);

      await expect(
        wallet.createTransaction(
          account,
          createMockTxIndent(account.address, 1),
          {
            utxos,
            fee: 20,
            subtractFeeFrom: [],
            replaceable: false,
          },
        ),
      ).rejects.toThrow('Transaction amount too small');
    });
  });

  describe('signTransaction', () => {
    it('signs an transaction', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(account.address, 2, 10000, 10000);

      const { tx } = await wallet.createTransaction(
        account,
        createMockTxIndent(account.address, DustLimit[account.scriptType] + 1),
        {
          utxos,
          fee: 1,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      const sign = await wallet.signTransaction(account.signer, tx);

      expect(sign).not.toBeNull();
      expect(sign).not.toBe('');
    });
  });
});
