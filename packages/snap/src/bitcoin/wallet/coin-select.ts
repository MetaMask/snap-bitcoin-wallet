import coinSelect from 'coinselect';

import type { Recipient } from '../../wallet';
import { TxValidationError } from './exceptions';
import type { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import { type SelectionResult } from './types';

export class CoinSelectService {
  protected readonly feeRate: number;

  constructor(feeRate: number) {
    this.feeRate = Math.round(feeRate);
  }

  selectCoins(
    inputs: TxInput[],
    recipients: Recipient[] | TxOutput[],
    changeTo: TxOutput,
  ): SelectionResult {
    const result = coinSelect(inputs, recipients, this.feeRate);

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
        if (output instanceof TxOutput) {
          selectedResult.outputs.push(output);
        } else {
          selectedResult.outputs.push(
            new TxOutput(output.value, output.address),
          );
        }
      } else {
        changeTo.value = output.value;
        selectedResult.change = changeTo;
      }
    }

    return selectedResult;
  }
}
