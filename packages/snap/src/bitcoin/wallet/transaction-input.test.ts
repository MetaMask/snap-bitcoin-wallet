import { networks } from 'bitcoinjs-lib';

import { generateFormatedUtxos } from '../../../test/utils';
import { ScriptType } from './constants';
import { BtcAccountDeriver } from './deriver';
import { TxInput } from './transaction-input';
import { BtcWallet } from './wallet';

jest.mock('../../utils/snap');

describe('TxInput', () => {
  const createMockWallet = (network) => {
    const instance = new BtcWallet(new BtcAccountDeriver(network), network);
    return {
      instance,
    };
  };

  it('return correct property', async () => {
    const wallet = createMockWallet(networks.testnet);
    const account = await wallet.instance.unlock(0, ScriptType.P2wpkh);
    const { script } = account;

    const utxo = generateFormatedUtxos(account.address, 1)[0];

    const input = new TxInput(utxo, script);

    expect(input.script).toStrictEqual(script);
    expect(input.value).toStrictEqual(utxo.value);
    expect(input.txHash).toStrictEqual(utxo.txHash);
    expect(input.index).toStrictEqual(utxo.index);
    expect(input.block).toStrictEqual(utxo.block);
  });

  it('return bigint val', async () => {
    const wallet = createMockWallet(networks.testnet);
    const account = await wallet.instance.unlock(0, ScriptType.P2wpkh);
    const { script } = account;

    const utxo = generateFormatedUtxos(account.address, 1)[0];

    const input = new TxInput(utxo, script);

    expect(input.bigIntValue).toStrictEqual(BigInt(utxo.value));
  });
});
