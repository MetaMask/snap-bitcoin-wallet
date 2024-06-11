import { Config } from '../config';
import { Caip2ChainId } from '../constants';

/**
 * Gets the explorer URL for a given bitcoin address and CAIP-2 Chain ID.
 *
 * @param address - The bitcoin address to get the explorer URL for.
 * @param caip2ChainId - The CAIP-2 Chain ID.
 * @returns The explorer URL as a string.
 * @throws An error if an invalid scope is provided.
 */
export function getExplorerUrl(address: string, caip2ChainId: string): string {
  switch (caip2ChainId) {
    case Caip2ChainId.Mainnet:
      return Config.explorer[Caip2ChainId.Mainnet].replace(
        // eslint-disable-next-line no-template-curly-in-string
        '${address}',
        address,
      );
    case Caip2ChainId.Testnet:
      return Config.explorer[Caip2ChainId.Testnet].replace(
        // eslint-disable-next-line no-template-curly-in-string
        '${address}',
        address,
      );
    default:
      throw new Error('Invalid Chain ID');
  }
}
