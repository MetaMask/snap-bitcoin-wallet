import { enums, string, pattern } from 'superstruct';

import { Config } from '../config';

export const assetsStruct = enums(Config.avaliableAssets);

export const scopeStruct = enums(Config.avaliableNetworks);

export const positiveStringStruct = pattern(
  string(),
  /^(?!0\d)(\d+(\.\d+)?)$/u,
);

export const txIdStruct = pattern(string(), /^[0-9a-fA-F]{64}$/u);
