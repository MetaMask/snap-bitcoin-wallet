import { crypto as cryptoUtils } from 'bitcoinjs-lib';
import type { Buffer } from 'buffer';
import coinSelect from 'coinselect';

import { hexToBuffer } from '../../../utils';
import { UtxoServiceError } from './exceptions';
import type { SpendTo, SelectedUtxos, Utxo } from './types';

export class CoinSelectService {
  protected readonly feeRate: number;

  constructor(feeRate: number) {
    this.feeRate = Math.round(feeRate);
  }

  /**
   * Selects UTXOs to spend for segwit output.
   * @param utxos - Array of UTXOs.
   * @param spendTos - Array of SpendTo objects.
   * @param script - Script hash of the segwit output.
   * @returns Selected UTXOs.
   */
  selectCoins(
    utxos: Utxo[],
    spendTos: SpendTo[],
    script: Buffer,
  ): SelectedUtxos {
    const utxosMap = new Map<string, Utxo>();

    const spendFrom = utxos.map((utxo) => {
      const id = cryptoUtils
        .sha256(
          hexToBuffer(
            `${utxo.txnHash},${utxo.block},${utxo.index},${utxo.value}`,
            false,
          ),
        )
        .toString('hex');

      utxosMap.set(id, utxo);

      return {
        id,
        value: utxo.value,
        script,
      };
    });

    const result = coinSelect(spendFrom, spendTos, this.feeRate);

    if (!result.inputs || !result.outputs) {
      throw new UtxoServiceError('Not enough funds');
    }

    const inputs: Utxo[] = [];
    for (const input of result.inputs) {
      const utxo = utxosMap.get(input.id);

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      inputs.push(utxo!);
    }

    return {
      ...result,
      inputs,
    };
  }
}
