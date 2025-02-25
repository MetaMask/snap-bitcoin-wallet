import type { AddressType, Network } from 'bitcoindevkit';

export type SnapConfig = {
  logLevel: string;
  encrypt: boolean;
  accounts: AccountsConfig;
  chain: ChainConfig;
  simpleHash: SimpleHashConfig;
  // Temporary config to set the expected confirmation target, should eventually be chosen by the user
  targetBlocksConfirmation: number;
  fallbackFeeRate: number;
  priceApi: PriceApiConfig;
  conversionsExpirationInterval: number;
};

export type AccountsConfig = {
  index: number;
  defaultNetwork: Network;
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
