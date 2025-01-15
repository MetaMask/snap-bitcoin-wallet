import type { AddressType, Network } from 'bitcoindevkit';

export type SnapConfig = {
  encrypt: boolean;
  accounts: AccountsConfig;
  chain: ChainConfig;
  keyringVersion: string;
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
