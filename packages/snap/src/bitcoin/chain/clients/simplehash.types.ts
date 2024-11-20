import type { Infer } from 'superstruct';
import { array, number, object, string } from 'superstruct';

export type SimpleHashClientOptions = {
  apiKey: string;
};

export const SimpleHashWalletAssetsByUtxoResponseStruct = object({
  count: number(),
  utxos: array(
    object({
      output: string(),
      value: number(),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      block_number: number(),
    }),
  ),
});

export type SimpleHashWalletAssetsByUtxoResponse = Infer<
  typeof SimpleHashWalletAssetsByUtxoResponseStruct
>;
