import { enums, string, pattern } from 'superstruct';

import { Config } from '../modules/config';

export const assetsStruct = enums(Config.avaliableAssets[Config.chain]);

export const scopeStruct = enums(Config.avaliableNetworks[Config.chain]);

export const numberStringStruct = pattern(string(), /^(?!0\d)(\d+(\.\d+)?)$/u);
