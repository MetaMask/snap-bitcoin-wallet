import { Chain, Config } from '../../config';
import { Network } from '../constants';

/**
 * Method to get ExplorerUrl by CAIP2 Chain Id string.
 *
 * @param address - The address to get the Explorer string for.
 * @param network - The CAIP2 Chain Id.
 * @returns The Explorer string.
 */
export function getExplorerUrl(address: string, network: string): string {
  switch (network) {
    case Network.Mainnet:
      return `${
        Config.explorer[Chain.Bitcoin][Network.Mainnet]
      }/address/${address}`;
    case Network.Testnet:
      return `${
        Config.explorer[Chain.Bitcoin][Network.Testnet]
      }/address/${address}`;
    default:
      throw new Error('Invalid network');
  }
}
