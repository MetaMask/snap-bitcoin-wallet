import { address as addressUtils, type Network } from 'bitcoinjs-lib';

/**
 * Returns the script for a Bitcoin destination address.
 *
 * @param address - The Bitcoin destination address.
 * @param network - The Bitcoin network.
 * @returns The Bitcoin script for the destination address.
 * @throws An error if the address does not have a matching script.
 */
export function getScriptForDestination(address: string, network: Network) {
  try {
    return addressUtils.toOutputScript(address, network);
  } catch (error) {
    throw new Error('Destination address has no matching Script');
  }
}
