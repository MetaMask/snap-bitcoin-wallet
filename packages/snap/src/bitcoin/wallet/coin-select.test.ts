import { networks } from 'bitcoinjs-lib';

import { generateFormatedUtxos } from '../../../test/utils';
import { ScriptType } from '../constants';
import { CoinSelectService } from './coin-select';
import { BtcAccountBip32Deriver } from './deriver';
import { SelectionResult } from './selection-result';
import { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import { BtcWallet } from './wallet';

jest.mock('../../libs/snap/helpers');

describe('CoinSelectService', () => {
  const createMockWallet = (network) => {
    const instance = new BtcWallet(
      new BtcAccountBip32Deriver(network),
      network,
    );
    return {
      instance,
    };
  };

  const prepareCoinSlect = async (
    network,
    outputVal = 1000,
    inputMin = 2000,
    inputMax = 1000000,
  ) => {
    const wallet = createMockWallet(network);
    const sender = await wallet.instance.unlock(0, ScriptType.P2wpkh);
    const receiver1 = await wallet.instance.unlock(1, ScriptType.P2wpkh);
    const receiver2 = await wallet.instance.unlock(2, ScriptType.P2wpkh);

    const utxos = generateFormatedUtxos(sender.address, 2, inputMin, inputMax);

    const outputs = [new TxOutput(outputVal, receiver1.address)];

    const inputs = utxos.map(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (utxo) => new TxInput(utxo, sender.payment.output!),
    );

    return {
      sender,
      receiver1,
      receiver2,
      utxos,
      outputs,
      inputs,
    };
  };

  describe('selectCoins', () => {
    it('selects utxos', async () => {
      const network = networks.testnet;
      const { inputs, outputs, sender } = await prepareCoinSlect(network);

      const coinSelectService = new CoinSelectService(1);

      const result = coinSelectService.selectCoins(inputs, outputs, sender);

      expect(result).toBeInstanceOf(SelectionResult);
      expect(result.fee).toBeGreaterThan(1);
    });

    it('throws `Insufficient funds` error if the given utxos is not sufficient', async () => {
      const network = networks.testnet;
      const { inputs, outputs, sender } = await prepareCoinSlect(
        network,
        100000,
        1,
        10,
      );

      const coinSelectService = new CoinSelectService(100);

      expect(() =>
        coinSelectService.selectCoins(inputs, outputs, sender),
      ).toThrow('Insufficient funds');
    });
  });
});
