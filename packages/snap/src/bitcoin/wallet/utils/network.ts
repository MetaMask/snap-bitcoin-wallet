import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { Caip2ChainId } from '../../../constants';

/**
 * Asserts a scope (CAIP-2 Chain ID) is supported.
 *
 * @param scope - A CAIP-2 Chain ID (scope).
 * @throws An error if an invalid network is provided.
 */
export function assertScopeIsSupported(scope: string) {
  const scopes = Object.values(Caip2ChainId) as string[];

  if (!scopes.includes(scope)) {
    throw new Error(`Invalid scope, must be one of: ${scopes.join(', ')}`);
  }
}

/**
 * Gets a bitcoinjs-lib network instance based on a given CAIP-2 Chain ID.
 *
 * @param caip2ChainId - The CAIP-2 Chain ID.
 * @returns The instance of bitcoinjs-lib network.
 * @throws An error if an invalid network is provided.
 */
export function getBtcNetwork(caip2ChainId: string) {
  switch (caip2ChainId) {
    case Caip2ChainId.Mainnet:
      return networks.bitcoin;
    case Caip2ChainId.Testnet:
      return networks.testnet;
    default:
      throw new Error('Invalid network');
  }
}

/**
 * Gets a CAIP-2 Chain ID based on a given bitcoinjs-lib network instance.
 *
 * @param network - The instance of bitcoinjs-lib network.
 * @returns The CAIP-2 Chain ID.
 * @throws An error if an invalid network is provided.
 */
export function getCaip2ChainId(network: Network): Caip2ChainId {
  switch (network) {
    case networks.bitcoin:
      return Caip2ChainId.Mainnet;
    case networks.testnet:
      return Caip2ChainId.Testnet;
    default:
      throw new Error('Invalid network');
  }
}
