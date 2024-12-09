export enum Caip2ChainId {
  Bitcoin = 'bip122:000000000019d6689c085ae165831e93',
  Testnet = 'bip122:000000000933ea01ad0ee984209779ba',
  Testnet4 = 'bip122:00000000da84f2bafbbc53dee25a72ae',
  Signet = 'bip122:00000008819873e925422c1ff0f99f7c',
  Regtest = 'bip122:regtest',
}

export enum Caip2AddressType {
  P2pkh = 'bip122:p2pkh',
  P2sh = 'bip122:p2sh',
  P2wpkh = 'bip122:p2wpkh',
  P2tr = 'bip122:p2tr',
}
