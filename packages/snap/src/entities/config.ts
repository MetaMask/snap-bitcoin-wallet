import type { Network } from 'bdk_wasm/bdk_wasm_bg';

export type SnapConfig = {
  encrypt: boolean;
  accounts: AccountsConfig;
  chain: ChainConfig;
  keyringVersion: string;
};

export type AccountsConfig = {
  index: number;
  defaultNetwork: string;
  defaultAddressType: string;
};

export type ChainConfig = {
  parallelRequests: number;
  stopGap: number;
  url: {
    [network in Network]: string;
  };
};
