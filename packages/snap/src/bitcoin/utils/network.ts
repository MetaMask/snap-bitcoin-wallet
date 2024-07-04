import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { Network as NetworkEnum } from '../constants';

/**
 * Gets a bitcoinjs-lib network instance based on a given CAIP-2 Chain ID.
 *
 * @param network - The CAIP-2 Chain ID.
 * @returns The instance of bitcoinjs-lib network.
 * @throws An error if an invalid network is provided.
 */
export function getBtcNetwork(network: string) {
  switch (network) {
    case NetworkEnum.Mainnet:
      return networks.bitcoin;
    case NetworkEnum.Testnet:
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
export function getCaip2ChainId(network: Network): NetworkEnum {
  switch (network) {
    case networks.bitcoin:
      return NetworkEnum.Mainnet;
    case networks.testnet:
      return NetworkEnum.Testnet;
    default:
      throw new Error('Invalid network');
  }
}
