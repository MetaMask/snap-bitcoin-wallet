import coinSelect from 'coinselect';

import { UtxoServiceError } from './exceptions';
import type { SpendTo, SelectedUtxos, Utxo } from './types';

export class UtxoService {
  /**
   * Selects UTXOs to spend.
   * @param utxos - Array of UTXOs.
   * @param spendTos - Array of SpendTo objects.
   * @param feeRate - Fee rate.
   * @returns Selected UTXOs.
   */
  selectCoins(
    utxos: Utxo[],
    spendTos: SpendTo[],
    feeRate: number,
  ): SelectedUtxos {
    const rate = Math.round(feeRate);
    const result = coinSelect(utxos, spendTos, rate);

    if (!result.inputs || !result.outputs) {
      throw new UtxoServiceError('Not enough funds');
    }

    return result;
  }
}
