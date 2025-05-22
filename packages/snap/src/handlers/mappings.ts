import type { AddressType, Network } from '@metamask/bitcoindevkit';
import type { DiscoveredAccount, KeyringAccount } from '@metamask/keyring-api';
import {
  BtcAccountType,
  BtcMethod,
  BtcScope,
  DiscoveredAccountType,
} from '@metamask/keyring-api';

import type { BitcoinAccount } from '../entities';
import { addressTypeToPurpose, networkToCoinType } from '../entities';

const reverseMapping = <
  From extends string | number | symbol,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  To extends string | number | symbol,
>(
  map: Record<From, To>,
): Record<To, From> =>
  Object.fromEntries(Object.entries(map).map(([from, to]) => [to, from]));

export const scopeToNetwork: Record<BtcScope, Network> = {
  [BtcScope.Mainnet]: 'bitcoin',
  [BtcScope.Testnet]: 'testnet',
  [BtcScope.Testnet4]: 'testnet4',
  [BtcScope.Signet]: 'signet',
  [BtcScope.Regtest]: 'regtest',
};

export const caipToAddressType: Record<BtcAccountType, AddressType> = {
  [BtcAccountType.P2pkh]: 'p2pkh',
  [BtcAccountType.P2sh]: 'p2sh',
  [BtcAccountType.P2wpkh]: 'p2wpkh',
  [BtcAccountType.P2tr]: 'p2tr',
};

export const networkToCaip2 = reverseMapping(scopeToNetwork);
export const addressTypeToCaip2 = reverseMapping(caipToAddressType);

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

export const addressTypeToName: Record<AddressType, string> = {
  p2pkh: 'Legacy',
  p2sh: 'Nested SegWit',
  p2wpkh: 'Native SegWit',
  p2tr: 'Taproot',
  p2wsh: 'Multisig',
};

export const networkToName: Record<Network, string> = {
  bitcoin: 'Bitcoin',
  testnet: 'Bitcoin Testnet',
  testnet4: 'Bitcoin Testnet4',
  signet: 'Bitcoin Signet',
  regtest: 'Bitcoin Regtest',
};

/**
 * Maps a Bitcoin Account to a Discovered Account.
 *
 * @param account - The Bitcoin account.
 * @param groupIndex - The group index.
 * @returns The Discovered account.
 */
export function mapToDiscoveredAccount(
  account: BitcoinAccount,
  groupIndex: number,
): DiscoveredAccount {
  return {
    type: DiscoveredAccountType.Bip44,
    scopes: [networkToCaip2[account.network]],
    derivationPath: `m/${addressTypeToPurpose[account.addressType]}'/${networkToCoinType[account.network]}'/${groupIndex}'`,
  };
}

/**
 * Maps a Bitcoin Account to a Keyring Account.
 *
 * @param account - The Bitcoin account.
 * @returns The Keyring account.
 */
export function mapToKeyringAccount(account: BitcoinAccount): KeyringAccount {
  return {
    type: addressTypeToCaip2[account.addressType] as KeyringAccount['type'],
    scopes: [networkToCaip2[account.network]],
    id: account.id,
    address: account.peekAddress(0).address.toString(),
    options: {},
    methods: [BtcMethod.SendBitcoin],
  };
}
