import type { AddressType, Network } from 'bitcoindevkit';

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

export const addressTypeToName: Record<AddressType, string> = {
  p2pkh: 'Legacy',
  p2sh: 'Nested SegWit',
  p2wpkh: 'Native SegWit',
  p2tr: 'Taproot',
  p2wsh: 'Multisig',
};

export const networkToName: Record<Network, string> = {
  bitcoin: 'Bitcoin',
  testnet: 'BTC Testnet',
  testnet4: 'BTC Testnet4',
  signet: 'BTC Regtest',
  regtest: 'BTC Regtest',
};
