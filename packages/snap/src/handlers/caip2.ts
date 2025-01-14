import { BtcScopes } from '@metamask/keyring-api';
import type { AddressType, Network } from 'bitcoindevkit';

import { reverseMapping } from './mapping';

export enum Caip2AddressType {
  P2pkh = 'bip122:p2pkh',
  P2sh = 'bip122:p2sh',
  P2wsh = 'bip122:p2wsh',
  P2wpkh = 'bip122:p2wpkh',
  P2tr = 'bip122:p2tr',
}

export const caip2ToNetwork: Record<string, Network> = {
  [BtcScopes.Mainnet]: 'bitcoin',
  [BtcScopes.Testnet]: 'testnet',
  [BtcScopes.Testnet4]: 'testnet4',
  [BtcScopes.Signet]: 'signet',
  [BtcScopes.Regtest]: 'regtest',
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
