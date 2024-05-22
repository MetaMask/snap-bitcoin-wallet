import type { Utxo } from '../../chain';

export type SpendTo = {
  address: string;
  value: number;
};

export type SelectedUtxos = {
  inputs: Utxo[];
  outputs: SpendTo[];
  fee: number;
};
