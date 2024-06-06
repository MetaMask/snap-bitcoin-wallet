import coinSelect from 'coinselect';

import { TxValidationError } from './exceptions';
import type { TxInput } from './transaction-input';
import type { TxOutput } from './transaction-output';
import { type SelectionResult } from './types';

export class CoinSelectService {
  protected readonly _feeRate: number;

  constructor(feeRate: number) {
    this._feeRate = Math.round(feeRate);
  }

  selectCoins(
    inputs: TxInput[],
    recipients: TxOutput[],
    changeTo: TxOutput,
  ): SelectionResult {
    const result = coinSelect(inputs, recipients, this._feeRate);

    if (!result.inputs || !result.outputs) {
      throw new TxValidationError('Insufficient funds');
    }

    const selectedResult: SelectionResult = {
      fee: result.fee,
      inputs: result.inputs,
      outputs: [],
    };

    // restructure outputs to avoid depends on coinselect output format
    for (const output of result.outputs) {
      if (output.address) {
        selectedResult.outputs.push(output);
      } else {
        changeTo.value = output.value;
        selectedResult.change = changeTo;
      }
    }

    return selectedResult;
  }
}
