import type { Network } from 'bitcoindevkit';

export enum Caip19Asset {
  Bitcoin = 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  Testnet = 'bip122:000000000933ea01ad0ee984209779ba/slip44:1',
  Testnet4 = 'bip122:00000000da84f2bafbbc53dee25a72ae/slip44:1',
  Signet = 'bip122:00000008819873e925422c1ff0f99f7c/slip44:1',
  Regtest = 'bip122:regtest/slip44:1',
}

export const networkToCaip19: Record<Network, Caip19Asset> = {
  bitcoin: Caip19Asset.Bitcoin,
  testnet: Caip19Asset.Testnet,
  testnet4: Caip19Asset.Testnet4,
  signet: Caip19Asset.Signet,
  regtest: Caip19Asset.Regtest,
};
