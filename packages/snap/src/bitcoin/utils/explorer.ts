import { Config } from '../../config';
import { Network } from '../constants';

/**
 * Gets the explorer URL for a given bitcoin address and CAIP-2 Chain ID.
 *
 * @param address - The bitcoin address to get the explorer URL for.
 * @param network - The CAIP-2 Chain ID.
 * @returns The explorer URL as a string.
 * @throws An error if an invalid network is provided.
 */
export function getExplorerUrl(address: string, network: string): string {
  switch (network) {
    case Network.Mainnet:
      return `${Config.explorer[Network.Mainnet]}/address/${address}`;
    case Network.Testnet:
      return `${Config.explorer[Network.Testnet]}/address/${address}`;
    default:
      throw new Error('Invalid network');
  }
}
