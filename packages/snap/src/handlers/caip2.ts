import type { AddressType, Network } from 'bitcoindevkit';

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
  P2wsh = 'bip122:p2wsh',
  P2wpkh = 'bip122:p2wpkh',
  P2tr = 'bip122:p2tr',
}

export const caip2ToNetwork: Record<Caip2ChainId, Network> = {
  [Caip2ChainId.Bitcoin]: 'bitcoin',
  [Caip2ChainId.Testnet]: 'testnet',
  [Caip2ChainId.Testnet4]: 'testnet4',
  [Caip2ChainId.Signet]: 'signet',
  [Caip2ChainId.Regtest]: 'regtest',
};

export const caip2ToAddressType: Record<Caip2AddressType, AddressType> = {
  [Caip2AddressType.P2pkh]: 'p2pkh',
  [Caip2AddressType.P2sh]: 'p2sh',
  [Caip2AddressType.P2wsh]: 'p2wsh',
  [Caip2AddressType.P2wpkh]: 'p2wpkh',
  [Caip2AddressType.P2tr]: 'p2tr',
};

export const addressTypeToCaip2: Record<AddressType, Caip2AddressType> =
  Object.fromEntries(
    Object.entries(caip2ToAddressType).map(([caip2, addrType]) => [
      addrType,
      caip2,
    ]),
  ) as Record<AddressType, Caip2AddressType>;
