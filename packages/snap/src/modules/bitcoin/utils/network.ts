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
