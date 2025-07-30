import type { AddressType, Network } from '@metamask/bitcoindevkit';

import type { LogLevel } from './logger';

export type SnapConfig = {
  logLevel: LogLevel;
  encrypt: boolean;
  chain: ChainConfig;
  targetBlocksConfirmation: number; // Temporary global config to set the expected confirmation target, should eventually be a user setting
  fallbackFeeRate: number;
  ratesRefreshInterval: string;
  priceApi: PriceApiConfig;
  conversionsExpirationInterval: number;
  defaultAddressType: AddressType;
};

export type ChainConfig = {
  parallelRequests: number;
  stopGap: number;
  maxRetries: number;
  url: {
    [network in Network]: string;
  };
  explorerUrl: {
    [network in Network]: string;
  };
};

export type PriceApiConfig = {
  url: string;
};
