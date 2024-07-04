import { enums, string, pattern } from 'superstruct';

import { Config } from '../config';

export const assetsStruct = enums(Config.avaliableAssets);

export const scopeStruct = enums(Config.avaliableNetworks);

export const positiveStringStruct = pattern(
  string(),
  /^(?!0\d)(\d+(\.\d+)?)$/u,
);

export const hexStringStruct = pattern(string(), /^(0x|0X)?[0-9a-fA-F]+$/u);
