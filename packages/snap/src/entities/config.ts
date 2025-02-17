import type { AddressType, Network } from 'bitcoindevkit';

export type SnapConfig = {
  encrypt: boolean;
  accounts: AccountsConfig;
  chain: ChainConfig;
  keyringVersion: string;
  simplehash: SimplehashConfig;
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
  // Temporary config to set the expected confirmation target, should eventually be chosen by the user
  targetBlocksConfirmation: number;
};

export type SimplehashConfig = {
  apiKey: string;
  url: {
    [network in Network]?: string;
  };
};
