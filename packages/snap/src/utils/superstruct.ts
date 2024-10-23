// eslint-disable-next-line import/no-named-as-default
import validate, { Network } from 'bitcoin-address-validation';
import { enums, string, pattern, refine } from 'superstruct';

import { Config } from '../config';
import { btcToSats } from './unit';

export const BitcoinAddressStruct = refine(
  string(),
  'BitcoinAddressStruct',
  (address: string) => {
    return (
      validate(address, Network.mainnet) || validate(address, Network.testnet)
    );
  },
);

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
      return 'Invalid amount, must be a positive finite number';
    }

    try {
      btcToSats(value);
    } catch (error) {
      return 'Invalid amount, out of bounds';
    }
    return true;
  },
);
