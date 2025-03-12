import { BtcScope } from '@metamask/keyring-api';
import type { AddressType, Network } from 'bitcoindevkit';

export enum Caip2AddressType {
  P2pkh = 'bip122:p2pkh',
  P2sh = 'bip122:p2sh',
  P2wsh = 'bip122:p2wsh',
  P2wpkh = 'bip122:p2wpkh',
  P2tr = 'bip122:p2tr',
}

export const caip2ToNetwork: Record<BtcScope, Network> = {
  [BtcScope.Mainnet]: 'bitcoin',
  [BtcScope.Testnet]: 'testnet',
  [BtcScope.Testnet4]: 'testnet4',
  [BtcScope.Signet]: 'signet',
  [BtcScope.Regtest]: 'regtest',
};

export const caip2ToAddressType: Record<Caip2AddressType, AddressType> = {
  [Caip2AddressType.P2pkh]: 'p2pkh',
  [Caip2AddressType.P2sh]: 'p2sh',
  [Caip2AddressType.P2wsh]: 'p2wsh',
  [Caip2AddressType.P2wpkh]: 'p2wpkh',
  [Caip2AddressType.P2tr]: 'p2tr',
};

export const networkToCaip2 = reverseMapping(caip2ToNetwork);
export const addressTypeToCaip2 = reverseMapping(caip2ToAddressType);

export enum Caip19Asset {
  Bitcoin = 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  Testnet = 'bip122:000000000933ea01ad0ee984209779ba/slip44:0',
  Testnet4 = 'bip122:00000000da84f2bafbbc53dee25a72ae/slip44:0',
  Signet = 'bip122:00000008819873e925422c1ff0f99f7c/slip44:0',
  Regtest = 'bip122:regtest/slip44:0',
}

export const networkToCaip19: Record<Network, Caip19Asset> = {
  bitcoin: Caip19Asset.Bitcoin,
  testnet: Caip19Asset.Testnet,
  testnet4: Caip19Asset.Testnet4,
  signet: Caip19Asset.Signet,
  regtest: Caip19Asset.Regtest,
};

/**
 * Reverse a map object.
 *
 * @param map - The map to reverse.
 * @returns New reversed map.
 */
export function reverseMapping<
  From extends string | number | symbol,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  To extends string | number | symbol,
>(map: Record<From, To>) {
  return Object.fromEntries(
    Object.entries(map).map(([from, to]) => [to, from]),
  ) as Record<To, From>;
}
