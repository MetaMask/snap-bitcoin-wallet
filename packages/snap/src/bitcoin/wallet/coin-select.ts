import coinSelect from 'coinselect';

import type { Recipient } from '../../wallet';
import { TxValidationError } from './exceptions';
import { SelectionResult } from './selection-result';
import type { TxInput } from './transaction-input';
import { TxOutput } from './transaction-output';
import { type IBtcAccount } from './types';

export class CoinSelectService {
  protected readonly feeRate: number;

  constructor(feeRate: number) {
    this.feeRate = Math.round(feeRate);
  }

  selectCoins(
    inputs: TxInput[],
    recipients: Recipient[],
    changeAccount: IBtcAccount,
  ): SelectionResult {
    const result = coinSelect(inputs, recipients, this.feeRate);

    if (!result.inputs || !result.outputs) {
      throw new TxValidationError('Insufficient funds');
    }

    const selectedResult = new SelectionResult();
    selectedResult.fee = result.fee;
    selectedResult.selectedInputs = result.inputs;

    for (const output of result.outputs) {
      if (output.address) {
        selectedResult.selectedOutputs.push(
          new TxOutput(output.value, output.address),
        );
      } else {
        selectedResult.change = new TxOutput(
          output.value,
          changeAccount.address,
        );
      }
    }

    return selectedResult;
  }
}
