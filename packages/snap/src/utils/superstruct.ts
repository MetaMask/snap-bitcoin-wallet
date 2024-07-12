import { enums, string, pattern, refine } from 'superstruct';

import { Config } from '../config';
import { btcToSats } from './unit';

export const assetsStruct = enums(Config.avaliableAssets);

export const scopeStruct = enums(Config.avaliableNetworks);

export const positiveStringStruct = pattern(
  string(),
  /^(?!0\d)(\d+(\.\d+)?)$/u,
);

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
