import { enums, string, pattern } from 'superstruct';

import { Config } from '../config';

export const assetsStruct = enums(Config.availableAssets);

export const scopeStruct = enums(Config.availableNetworks);

export const positiveStringStruct = pattern(
  string(),
  /^(?!0\d)(\d+(\.\d+)?)$/u,
);

export const txIdStruct = pattern(string(), /^[0-9a-fA-F]{64}$/u);
