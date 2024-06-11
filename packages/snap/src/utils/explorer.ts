import { Network } from '../bitcoin/constants';
import { Config } from '../config';

/**
 * Gets the explorer URL for a given bitcoin address and CAIP-2 Chain ID.
 *
 * @param address - The bitcoin address to get the explorer URL for.
 * @param scope - The CAIP-2 Chain ID.
 * @returns The explorer URL as a string.
 * @throws An error if an invalid scope is provided.
 */
export function getExplorerUrl(address: string, scope: string): string {
  switch (scope) {
    case Network.Mainnet:
      // eslint-disable-next-line no-template-curly-in-string
      return Config.explorer[Network.Mainnet].replace('${address}', address);
    case Network.Testnet:
      // eslint-disable-next-line no-template-curly-in-string
      return Config.explorer[Network.Testnet].replace('${address}', address);
    default:
      throw new Error('Invalid scope');
  }
}
