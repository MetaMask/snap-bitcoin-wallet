import { Network } from 'bdk_wasm';

export enum Caip19Asset {
  Bitcoin = 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  Testnet = 'bip122:000000000933ea01ad0ee984209779ba/slip44:0',
  Testnet4 = 'bip122:00000000da84f2bafbbc53dee25a72ae/slip44:0',
  Signet = 'bip122:00000008819873e925422c1ff0f99f7c/slip44:0',
  Regtest = 'bip122:regtest/slip44:0',
}

export const networkToCaip19: Record<Network, Caip19Asset> = {
  [Network.Bitcoin]: Caip19Asset.Bitcoin,
  [Network.Testnet]: Caip19Asset.Testnet,
  [Network.Testnet4]: Caip19Asset.Testnet4,
  [Network.Signet]: Caip19Asset.Signet,
  [Network.Regtest]: Caip19Asset.Regtest,
};
