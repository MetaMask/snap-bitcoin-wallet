import type { CaipChainId } from '@metamask/utils';

export enum Caip2ChainId {
  Mainnet = 'bip122:000000000019d6689c085ae165831e93',
  Testnet = 'bip122:000000000933ea01ad0ee984209779ba',
}

export enum Caip2Asset {
  Btc = 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  TBtc = 'bip122:000000000933ea01ad0ee984209779ba/slip44:0',
}

export const Caip2ChainIdToNetworkName: Record<CaipChainId, string> = {
  [Caip2ChainId.Mainnet]: 'Bitcoin Mainnet',
  [Caip2ChainId.Testnet]: 'Bitcoin Testnet',
};

export enum BaseExplorerUrl {
  Mainnet = 'https://blockstream.info/address',
  Testnet = 'https://blockstream.info/testnet/address',
}
