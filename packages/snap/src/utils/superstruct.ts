import { enums, string, pattern } from 'superstruct';

import { Config } from '../config';

export const AssetsStruct = enums(Config.avaliableAssets);

export const ScopeStruct = enums(Config.avaliableNetworks);

export const PositiveStringStruct = pattern(
  string(),
  /^(?!0\d)(\d+(\.\d+)?)$/u,
);

export const TxIdStruct = pattern(string(), /^[0-9a-fA-F]{64}$/u);
