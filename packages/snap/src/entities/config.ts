import type { AddressType, Network } from 'bitcoindevkit';

import type { LogLevel } from './logger';

export type SnapConfig = {
  logLevel: LogLevel;
  encrypt: boolean;
  accounts: AccountsConfig;
  chain: ChainConfig;
  simpleHash: SimpleHashConfig;
  // Temporary config to set the expected confirmation target, should eventually be chosen by the user
  targetBlocksConfirmation: number;
  fallbackFeeRate: number;
  ratesRefreshInterval: string;
  priceApi: PriceApiConfig;
  conversionsExpirationInterval: number;
};

export type AccountsConfig = {
  index: number;
  defaultAddressType: AddressType;
};

export type ChainConfig = {
  parallelRequests: number;
  stopGap: number;
  url: {
    [network in Network]: string;
  };
};

export type SimpleHashConfig = {
  apiKey?: string;
  url: {
    [network in Network]?: string;
  };
};

export type PriceApiConfig = {
  url: string;
};
