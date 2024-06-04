import type { TxInput } from './transaction-input';
import type { TxOutput } from './transaction-output';

export class SelectionResult {
  selectedInputs: TxInput[];

  selectedOutputs: TxOutput[];

  change: TxOutput;

  fee: number;

  constructor() {
    this.selectedInputs = [];
    this.selectedOutputs = [];
  }
}
