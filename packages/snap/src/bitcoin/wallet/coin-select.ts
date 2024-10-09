import coinSelect from 'coinselect';

import type { TxInput } from './transaction-input';
import type { TxOutput } from './transaction-output';

export type SelectionResult = {
  change?: TxOutput;
  fee: number;
  inputs: TxInput[];
  outputs: TxOutput[];
};

export class CoinSelectService {
  protected readonly _feeRate: number;

  constructor(feeRate: number) {
    this._feeRate = Math.round(feeRate);
  }

  /**
   * This function selects the UTXOs that will be used to pay for a transaction and its associated gas fee.
   *
   * @param inputs - An array of input objects.
   * @param outputs - An array of output objects.
   * @param changeTo - The change output object.
   * @returns A SelectionResult object that includes the calculated transaction fee, selected inputs, outputs, and change (if any).
   */
  selectCoins(
    inputs: TxInput[],
    outputs: TxOutput[],
    changeTo: TxOutput,
  ): SelectionResult {
    const result = coinSelect(inputs, outputs, this._feeRate);

    const selectedResult: SelectionResult = {
      fee: result.fee,
      // CoinSelect returns undefined inputs when the provided UTXOs are insufficient,
      // Hence, assign an empty array to standardize the return value
      inputs: result.inputs ?? [],
      outputs: [],
    };

    if (result.outputs) {
      // Re-structure outputs to avoid depending on `coinSelect` output structure
      for (const output of result.outputs) {
        if (output.address) {
          selectedResult.outputs.push(output);
        } else {
          // We only support 1 change output, so we do check if there are more than 1
          // and raise an error to avoid overwriting it
          if (selectedResult.change !== undefined) {
            throw new Error(
              'Unexpected error: found more than 1 change output',
            );
          }
          changeTo.value = output.value;
          selectedResult.change = changeTo;
        }
      }
    }

    return selectedResult;
  }
}
