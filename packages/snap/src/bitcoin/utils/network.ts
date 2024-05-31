import type { Network } from 'bitcoinjs-lib';
import { networks } from 'bitcoinjs-lib';

import { Network as NetworkEnum } from '../constants';

/**
 * Method to get bitcoinjs-lib network by CAIP2 Chain Id string.
 *
 * @param network - The CAIP2 Chain Id.
 * @returns The instance of bitcoinjs-lib network.
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
 * Method to get CAIP2 Chain Id string by bitcoinjs-lib network.
 *
 * @param network - The instance of bitcoinjs-lib network.
 * @returns The CAIP2 Chain Id.
 */
export function getCaip2Network(network: Network): NetworkEnum {
  switch (network) {
    case networks.bitcoin:
      return NetworkEnum.Mainnet;
    case networks.testnet:
      return NetworkEnum.Testnet;
    default:
      throw new Error('Invalid network');
  }
}
