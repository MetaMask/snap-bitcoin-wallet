import { networks } from 'bitcoinjs-lib';

import { generateFormattedUtxos } from '../../../test/utils';
import { P2WPKHAccount, P2WPKHTestnetAccount } from './account';
import { CoinSelectService } from './coin-select';
import { DustLimit, ScriptType } from './constants';
import { BtcAccountDeriver } from './deriver';
import { WalletError } from './exceptions';
import { TxInfo } from './transaction-info';
import { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import { BtcWallet } from './wallet';

jest.mock('../../utils/snap');
jest.mock('../../utils/logger');

describe('BtcWallet', () => {
  const bip44Account = "0'";
  const bip44Change = '0';

  const createMockDeriver = (network) => {
    const rootSpy = jest.spyOn(BtcAccountDeriver.prototype, 'getRoot');
    const childSpy = jest.spyOn(BtcAccountDeriver.prototype, 'getChild');

    return {
      instance: new BtcAccountDeriver(network),
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
    const p2wpkhPathMainnet = P2WPKHAccount.path;
    const p2wpkhPathTestnet = P2WPKHTestnetAccount.path;

    it('creates an `Account` object with different hd path on different network', async () => {
      const { instance, rootSpy } = createMockWallet(networks.testnet);
      const { instance: mainnetInstance, rootSpy: mainnetRootSpy } =
        createMockWallet(networks.bitcoin);

      const idx = 0;

      const testnetAcc = await instance.unlock(idx);
      const mainnetAcc = await mainnetInstance.unlock(idx);

      expect(mainnetRootSpy).toHaveBeenCalledWith(p2wpkhPathMainnet);
      expect(rootSpy).toHaveBeenCalledWith(p2wpkhPathTestnet);
      expect(testnetAcc.signer.publicKey).not.toStrictEqual(
        mainnetAcc.signer.publicKey,
      );
    });

    it('creates an `Account` object with default type', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance } = createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx);

      expect(result).toBeInstanceOf(P2WPKHTestnetAccount);
      expect(rootSpy).toHaveBeenCalledWith(p2wpkhPathTestnet);
      expect(childSpy).toHaveBeenCalledWith(expect.any(Object), [
        `m`,
        bip44Account,
        bip44Change,
        `${idx}`,
      ]);
    });

    it('creates an `Account` object with type bip122:p2wpkh', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance } = createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, `bip122:p2wpkh`);

      expect(result).toBeInstanceOf(P2WPKHTestnetAccount);
      expect(rootSpy).toHaveBeenCalledWith(p2wpkhPathTestnet);
      expect(childSpy).toHaveBeenCalledWith(expect.any(Object), [
        `m`,
        bip44Account,
        bip44Change,
        `${idx}`,
      ]);
    });

    it('creates an `Account` object with type `p2wpkh`', async () => {
      const network = networks.testnet;
      const { rootSpy, childSpy, instance } = createMockWallet(network);
      const idx = 0;

      const result = await instance.unlock(idx, ScriptType.P2wpkh);

      expect(result).toBeInstanceOf(P2WPKHTestnetAccount);
      expect(rootSpy).toHaveBeenCalledWith(p2wpkhPathTestnet);
      expect(childSpy).toHaveBeenCalledWith(expect.any(Object), [
        `m`,
        bip44Account,
        bip44Change,
        `${idx}`,
      ]);
    });

    it('throws error if the account cannot be unlocked', async () => {
      const network = networks.testnet;
      const idx = 0;
      const { instance } = createMockWallet(network);

      await expect(instance.unlock(idx, ScriptType.P2pkh)).rejects.toThrow(
        WalletError,
      );
    });

    it('throws `Invalid network` error if the network is not supported', async () => {
      const network = networks.regtest;
      const idx = 0;
      const { instance } = createMockWallet(network);

      await expect(instance.unlock(idx, ScriptType.P2wpkh)).rejects.toThrow(
        `Invalid network`,
      );
    });
  });

  describe('createTransaction', () => {
    it('creates an transaction with changes', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);

      const utxos = generateFormattedUtxos(
        account.address,
        200,
        100000,
        100000,
      );

      const result = await wallet.createTransaction(
        account,
        createMockTxIndent(account.address, 100000),
        {
          utxos,
          fee: 56,
          subtractFeeFrom: [],
          replaceable: false,
        },
      );

      const info = result.txInfo;
      const { recipients } = info;
      const { change } = info;

      expect(recipients).toHaveLength(1);
      expect(change).toBeDefined();
      expect(result).toStrictEqual({
        tx: expect.any(String),
        txInfo: expect.any(TxInfo),
      });
    });

    it('creates an transaction without changes', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormattedUtxos(account.address, 200, 10000, 10000);

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

      const info = result.txInfo;
      const { recipients } = info;
      const { change } = info;

      expect(recipients).toHaveLength(1);
      expect(change).toBeUndefined();
      expect(result).toStrictEqual({
        tx: expect.any(String),
        txInfo: expect.any(TxInfo),
      });
    });

    it('passes correct parameter to CoinSelectService', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormattedUtxos(account.address, 2);
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
      const utxos = generateFormattedUtxos(chgAccount.address, 2, 10000, 10000);
      const coinSelectServiceSpy = jest.spyOn(
        CoinSelectService.prototype,
        'selectCoins',
      );

      const selectionResult = {
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

      const info: TxInfo = result.txInfo as unknown as TxInfo;

      expect(info.txFee).toBe(BigInt(19500));
      expect(info.change).toBeUndefined();
    });

    it('throws `Transaction amount too small` error if the transaction output is too small', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormattedUtxos(account.address, 2, 8000, 8000);

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

    it('throws `Insufficient funds` error if the given utxos is not sufficient', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const chgAccount = await wallet.unlock(0, ScriptType.P2wpkh);
      const recipient = await wallet.unlock(1, ScriptType.P2wpkh);
      const utxos = generateFormatedUtxos(chgAccount.address, 2, 1000, 1000);

      await expect(
        wallet.createTransaction(
          chgAccount,
          createMockTxIndent(recipient.address, 50000),
          {
            utxos,
            fee: 20,
            subtractFeeFrom: [],
            replaceable: false,
          },
        ),
      ).rejects.toThrow('Insufficient funds');
    });
  });

  describe('signTransaction', () => {
    it('signs an transaction', async () => {
      const network = networks.testnet;
      const { instance } = createMockDeriver(network);
      const wallet = new BtcWallet(instance, network);
      const account = await wallet.unlock(0, ScriptType.P2wpkh);
      const utxos = generateFormattedUtxos(account.address, 2, 10000, 10000);

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
