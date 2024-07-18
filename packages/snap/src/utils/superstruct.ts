import { enums, string, pattern, refine } from 'superstruct';

import { Config } from '../config';
import { btcToSats } from './unit';

export const AssetsStruct = enums(Config.availableAssets);

export const ScopeStruct = enums(Config.availableNetworks);

export const PositiveNumberStringStruct = pattern(
  string(),
  /^(?!0\d)(\d+(\.\d+)?)$/u,
);

export const TxIdStruct = pattern(string(), /^[0-9a-fA-F]{64}$/u);

export const AmountStruct = refine(
  string(),
  'AmountStruct',
  (value: string) => {
    const parsedVal = parseFloat(value);
    if (
      Number.isNaN(parsedVal) ||
      parsedVal <= 0 ||
      !Number.isFinite(parsedVal)
    ) {
      return 'Invalid amount for send';
    }

    try {
      btcToSats(value);
    } catch (error) {
      return 'Invalid amount for send';
    }
    return true;
  },
);
