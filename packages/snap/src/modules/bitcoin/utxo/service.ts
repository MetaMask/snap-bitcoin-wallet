import coinSelect from 'coinselect';

import type { Utxo } from '../../chain';
import { UtxoServiceError } from './exceptions';
import type { SpendTo, SelectedUtxos } from './types';

export class UtxoService {
  selectUtxosToSpend(
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
